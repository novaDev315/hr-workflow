import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { and, asc, desc, eq, gte, isNotNull, lte, or, sql, SQL } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../common/current-user.decorator';
import { ADMIN_ACCESS_ROLE_KEYS } from '../common/system-roles';
import {
  formatAmount,
  formatDateRange,
  formatIsoDate,
  formatMoney,
  formatPeriodMonth,
  pluralize,
} from '../common/document-format';
import { bidiIsolate, createSimplePdf, personLabelForPdf } from '../common/simple-pdf';
import {
  EmployeeVisibilityScope,
  hasAccountManagerAccess,
  resolveEmployeeVisibilityScope,
} from '../common/access-control';
import {
  attendanceRecords,
  companySettings,
  departments,
  designations,
  employees,
  leaveRequests,
  leaveTypes,
  payrollPeriods,
  payslips,
  policyDocuments,
} from '../database/drizzle/schema';

@Injectable()
export class ReportsService {
  constructor(private readonly database: DatabaseService) {}

  async dashboard(currentUser: AuthenticatedUser, periodMonth?: string) {
    this.assertCanViewReports(currentUser.roles);

    const normalizedMonth = this.normalizePeriodMonth(periodMonth);
    const { startDate, endDate } = this.getPeriodRange(normalizedMonth);
    const scope = await resolveEmployeeVisibilityScope(this.database, currentUser);
    const visibilityCondition = this.buildEmployeeVisibilityCondition(scope);
    // Salary figures are restricted to ADMIN / HR_ADMIN; managers and supervisors
    // would otherwise infer individual pay from small teams.
    const canViewPayroll = hasAccountManagerAccess(currentUser.roles);

    const [
      activeEmployees,
      pendingLeaveRequests,
      processedPayrollPeriods,
      publishedPolicies,
      monthlyPayrollNetPay,
      departmentHeadcount,
      recentHires,
      attendanceSummary,
      payrollDepartmentCosts,
      pendingLeaveApprovals,
      publishedPolicyRows,
    ] = await Promise.all([
      this.countActiveEmployees(visibilityCondition),
      this.countPendingLeaveRequests(visibilityCondition),
      this.countProcessedPayrollPeriods(visibilityCondition),
      this.countPublishedPolicies(),
      canViewPayroll
        ? this.sumMonthlyPayrollNetPay(normalizedMonth, visibilityCondition)
        : Promise.resolve(undefined),
      this.departmentHeadcount(visibilityCondition),
      this.recentHires(endDate, visibilityCondition),
      this.attendanceSummary(startDate, endDate, visibilityCondition),
      canViewPayroll
        ? this.payrollDepartmentCosts(normalizedMonth, visibilityCondition)
        : Promise.resolve([]),
      this.pendingLeaveApprovals(visibilityCondition),
      this.publishedPolicyRows(),
    ]);

    return {
      accessScopeLabel: scope.label,
      canViewPayroll,
      overview: {
        activeEmployees: Number(activeEmployees?.count ?? '0'),
        pendingLeaveRequests: Number(pendingLeaveRequests?.count ?? '0'),
        processedPayrollPeriods: Number(processedPayrollPeriods?.count ?? '0'),
        publishedPolicies: Number(publishedPolicies?.count ?? '0'),
        monthlyPayrollNetPay: Number(monthlyPayrollNetPay?.total ?? '0'),
      },
      departmentHeadcount,
      recentHires,
      attendanceSummary,
      payrollDepartmentCosts,
      pendingLeaveApprovals,
      publishedPolicies: publishedPolicyRows,
    };
  }

  async exportDashboardPdf(currentUser: AuthenticatedUser, periodMonth?: string) {
    const normalizedMonth = this.normalizePeriodMonth(periodMonth);
    const dashboard = await this.dashboard(currentUser, normalizedMonth);
    const { companyName, timeZone, currencyCode } = await this.companyProfile();
    const pdf = createSimplePdf(
      `${bidiIsolate(companyName)} Operational Report`,
      `Reporting month: ${formatPeriodMonth(normalizedMonth)} | Scope: ${bidiIsolate(dashboard.accessScopeLabel)}`,
      [
        {
          heading: 'Overview',
          lines: [
            `Active Employees: ${dashboard.overview.activeEmployees}`,
            `Pending Leave Requests: ${dashboard.overview.pendingLeaveRequests}`,
            `Processed Payroll Periods: ${dashboard.overview.processedPayrollPeriods}`,
            `Published Policies: ${dashboard.overview.publishedPolicies}`,
            ...(dashboard.canViewPayroll
              ? [`Monthly Net Pay: ${formatMoney(dashboard.overview.monthlyPayrollNetPay, currencyCode)}`]
              : []),
          ],
        },
        {
          heading: 'Department Headcount',
          lines: dashboard.departmentHeadcount.map(
            (row) => `${bidiIsolate(row.departmentName)}: ${pluralize(row.employeeCount, 'employee')}`,
          ),
        },
        {
          heading: 'Attendance Summary',
          lines:
            dashboard.attendanceSummary.length > 0
              ? dashboard.attendanceSummary.map(
                  (row) =>
                    `${personLabelForPdf(row.fullName, row.employeeNumber)} - ${pluralize(row.attendanceDays, 'attendance day')}, ${formatAmount(row.overtimeHours)} overtime hours`,
                )
              : ['No attendance records found for this month.'],
        },
        {
          heading: 'Pending Leave Approvals',
          lines:
            dashboard.pendingLeaveApprovals.length > 0
              ? dashboard.pendingLeaveApprovals.map(
                  (row) =>
                    `${personLabelForPdf(row.fullName, row.employeeNumber)} - ${bidiIsolate(row.leaveTypeName)}, ${formatDateRange(row.startDate, row.endDate)} (${pluralize(row.totalDays, 'day')})`,
                )
              : ['No pending leave approvals.'],
        },
        ...(dashboard.canViewPayroll
          ? [
              {
                heading: 'Payroll Cost By Department',
                lines: dashboard.payrollDepartmentCosts.map(
                  (row) =>
                    `${bidiIsolate(row.departmentName)}: ${pluralize(row.payslipCount, 'payslip')}, total net pay ${formatMoney(row.totalNetPay, currencyCode)}`,
                ),
              },
            ]
          : []),
        {
          heading: 'Published Policies',
          lines:
            dashboard.publishedPolicies.length > 0
              ? dashboard.publishedPolicies.map(
                  (row) =>
                    `${bidiIsolate(row.title)} (${bidiIsolate(row.category)}) v${row.version} effective ${formatIsoDate(row.effectiveDate)}`,
                )
              : ['No published policies found.'],
        },
      ],
      { timeZone },
    );

    return {
      fileName: `reports-${normalizedMonth}.pdf`,
      mimeType: 'application/pdf',
      contentBase64: pdf.toString('base64'),
    };
  }

  private async companyProfile() {
    const [row] = await this.database.drizzle
      .select({
        companyName: companySettings.companyName,
        timeZone: companySettings.timezone,
        currencyCode: companySettings.currencyCode,
      })
      .from(companySettings)
      .where(eq(companySettings.singletonKey, 'default'))
      .limit(1);

    return {
      companyName: row?.companyName?.trim() || 'HRFlow Pro',
      timeZone: row?.timeZone ?? null,
      currencyCode: row?.currencyCode ?? 'AED',
    };
  }

  private async countActiveEmployees(visibilityCondition?: SQL) {
    const [row] = await this.database.drizzle
      .select({ count: sql<string>`COUNT(*)::text` })
      .from(employees)
      .where(this.combineConditions(eq(employees.isActive, true), visibilityCondition));

    return row;
  }

  private async countPendingLeaveRequests(visibilityCondition?: SQL) {
    const [row] = await this.database.drizzle
      .select({ count: sql<string>`COUNT(*)::text` })
      .from(leaveRequests)
      .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
      .where(
        this.combineConditions(
          eq(leaveRequests.status, 'PENDING'),
          visibilityCondition,
        ),
      );

    return row;
  }

  private async countProcessedPayrollPeriods(visibilityCondition?: SQL) {
    const [row] = await this.database.drizzle
      .select({
        count: sql<string>`COUNT(DISTINCT ${payrollPeriods.id})::text`,
      })
      .from(payrollPeriods)
      .innerJoin(payslips, eq(payslips.payrollPeriodId, payrollPeriods.id))
      .innerJoin(employees, eq(employees.id, payslips.employeeId))
      .where(
        this.combineConditions(
          or(
            eq(payrollPeriods.status, 'PROCESSED'),
            eq(payrollPeriods.status, 'PAID'),
          ),
          visibilityCondition,
        ),
      );

    return row;
  }

  private async countPublishedPolicies() {
    const [row] = await this.database.drizzle
      .select({ count: sql<string>`COUNT(*)::text` })
      .from(policyDocuments)
      .where(eq(policyDocuments.status, 'PUBLISHED'));

    return row;
  }

  private async sumMonthlyPayrollNetPay(
    periodMonth: string,
    visibilityCondition?: SQL,
  ) {
    const [row] = await this.database.drizzle
      .select({
        total: sql<string>`COALESCE(ROUND(SUM(${payslips.netPay})::numeric, 2), 0)::float8::text`,
      })
      .from(payslips)
      .innerJoin(payrollPeriods, eq(payrollPeriods.id, payslips.payrollPeriodId))
      .innerJoin(employees, eq(employees.id, payslips.employeeId))
      .where(
        this.combineConditions(
          eq(payrollPeriods.periodMonth, periodMonth),
          visibilityCondition,
        ),
      );

    return row;
  }

  private async departmentHeadcount(visibilityCondition?: SQL) {
    return this.database.drizzle
      .select({
        departmentName: departments.name,
        employeeCount: sql<number>`COUNT(${employees.id})::int`,
      })
      .from(departments)
      .leftJoin(
        employees,
        and(
          eq(employees.departmentId, departments.id),
          eq(employees.isActive, true),
        ),
      )
      .where(visibilityCondition)
      .groupBy(departments.id)
      .having(sql`COUNT(${employees.id}) > 0`)
      .orderBy(sql`COUNT(${employees.id}) DESC`, asc(departments.name));
  }

  private async recentHires(monthEndDate: string, visibilityCondition?: SQL) {
    // Hires within the 90 days ending at the selected month's end.
    const windowStart = new Date(Date.parse(`${monthEndDate}T00:00:00.000Z`));
    windowStart.setUTCDate(windowStart.getUTCDate() - 89);
    const windowStartDate = windowStart.toISOString().slice(0, 10);

    return this.database.drizzle
      .select({
        employeeNumber: employees.employeeNumber,
        fullName: sql<string>`CONCAT(${employees.firstName}, ' ', ${employees.lastName})`,
        joinDate: sql<string>`${employees.joinDate}::text`,
        departmentName: departments.name,
        designationTitle: designations.title,
      })
      .from(employees)
      .innerJoin(departments, eq(departments.id, employees.departmentId))
      .innerJoin(designations, eq(designations.id, employees.designationId))
      .where(
        this.combineConditions(
          gte(employees.joinDate, windowStartDate),
          lte(employees.joinDate, monthEndDate),
          visibilityCondition,
        ),
      )
      .orderBy(desc(employees.joinDate))
      .limit(8);
  }

  private async attendanceSummary(
    startDate: string,
    endDate: string,
    visibilityCondition?: SQL,
  ) {
    return this.database.drizzle
      .select({
        employeeNumber: employees.employeeNumber,
        fullName: sql<string>`CONCAT(${employees.firstName}, ' ', ${employees.lastName})`,
        // A day counts once the employee has clocked in (open or completed);
        // hours stay based on completed records only.
        attendanceDays: sql<number>`COUNT(DISTINCT ${attendanceRecords.attendanceDate})::float`,
        overtimeHours: sql<number>`COALESCE(SUM(${attendanceRecords.overtimeHours}) FILTER (WHERE ${attendanceRecords.status} = 'COMPLETED'), 0)`,
      })
      .from(employees)
      .leftJoin(
        attendanceRecords,
        and(
          eq(attendanceRecords.employeeId, employees.id),
          gte(attendanceRecords.attendanceDate, startDate),
          lte(attendanceRecords.attendanceDate, endDate),
          isNotNull(attendanceRecords.clockInAt),
        ),
      )
      .where(this.combineConditions(eq(employees.isActive, true), visibilityCondition))
      .groupBy(employees.id)
      .orderBy(
        sql`COUNT(DISTINCT ${attendanceRecords.attendanceDate}) DESC`,
        sql`SUM(${attendanceRecords.overtimeHours}) FILTER (WHERE ${attendanceRecords.status} = 'COMPLETED') DESC NULLS LAST`,
        asc(employees.lastName),
      )
      .limit(10);
  }

  private async payrollDepartmentCosts(
    periodMonth: string,
    visibilityCondition?: SQL,
  ) {
    return this.database.drizzle
      .select({
        departmentName: departments.name,
        payslipCount: sql<number>`COUNT(${payslips.id})::int`,
        totalNetPay: sql<number>`COALESCE(ROUND(SUM(${payslips.netPay})::numeric, 2), 0)::float8`,
      })
      .from(departments)
      .leftJoin(employees, eq(employees.departmentId, departments.id))
      .leftJoin(payrollPeriods, eq(payrollPeriods.periodMonth, periodMonth))
      .leftJoin(
        payslips,
        and(
          eq(payslips.employeeId, employees.id),
          eq(payslips.payrollPeriodId, payrollPeriods.id),
        ),
      )
      .where(visibilityCondition)
      .groupBy(departments.id)
      .having(sql`COUNT(${employees.id}) > 0`)
      .orderBy(
        sql`COALESCE(ROUND(SUM(${payslips.netPay})::numeric, 2), 0) DESC`,
        asc(departments.name),
      );
  }

  private async pendingLeaveApprovals(visibilityCondition?: SQL) {
    return this.database.drizzle
      .select({
        employeeNumber: employees.employeeNumber,
        fullName: sql<string>`CONCAT(${employees.firstName}, ' ', ${employees.lastName})`,
        leaveTypeName: leaveTypes.name,
        startDate: sql<string>`${leaveRequests.startDate}::text`,
        endDate: sql<string>`${leaveRequests.endDate}::text`,
        totalDays: leaveRequests.totalDays,
      })
      .from(leaveRequests)
      .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
      .innerJoin(leaveTypes, eq(leaveTypes.id, leaveRequests.leaveTypeId))
      .where(
        this.combineConditions(
          eq(leaveRequests.status, 'PENDING'),
          visibilityCondition,
        ),
      )
      .orderBy(asc(leaveRequests.requestedAt))
      .limit(10);
  }

  private async publishedPolicyRows() {
    return this.database.drizzle
      .select({
        title: policyDocuments.title,
        category: policyDocuments.category,
        version: policyDocuments.version,
        effectiveDate: sql<string>`${policyDocuments.effectiveDate}::text`,
      })
      .from(policyDocuments)
      .where(eq(policyDocuments.status, 'PUBLISHED'))
      .orderBy(
        desc(policyDocuments.effectiveDate),
        sql`${policyDocuments.publishedAt} DESC NULLS LAST`,
      )
      .limit(6);
  }

  private buildEmployeeVisibilityCondition(scope: EmployeeVisibilityScope) {
    switch (scope.kind) {
      case 'all':
        return undefined;
      case 'department':
        return eq(employees.departmentId, scope.departmentId);
      case 'supervisor':
        return or(
          eq(employees.id, scope.employeeId),
          eq(employees.supervisorId, scope.employeeId),
        );
      case 'self':
        return eq(employees.id, scope.employeeId);
    }
  }

  private combineConditions(...conditions: Array<SQL | undefined>) {
    const present = conditions.filter(Boolean) as SQL[];
    return present.length > 0 ? and(...present) : undefined;
  }

  private assertCanViewReports(roles: string[]) {
    const hasAccess = roles.some((role) =>
      ADMIN_ACCESS_ROLE_KEYS.includes(
        role as (typeof ADMIN_ACCESS_ROLE_KEYS)[number],
      ),
    );

    if (!hasAccess) {
      throw new ForbiddenException('Only staff and admin accounts can access reports');
    }
  }

  private normalizePeriodMonth(periodMonth?: string) {
    if (periodMonth?.trim()) {
      const normalized = periodMonth.trim();
      if (!/^\d{4}-\d{2}$/.test(normalized)) {
        throw new BadRequestException('Report month must use YYYY-MM format');
      }

      return normalized;
    }

    return new Date().toISOString().slice(0, 7);
  }

  private getPeriodRange(periodMonth: string) {
    const [yearText, monthText] = periodMonth.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const startDate = `${yearText}-${monthText}-01`;
    const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

    return { startDate, endDate };
  }
}
