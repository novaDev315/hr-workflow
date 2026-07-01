import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { and, asc, desc, eq, gte, lte, or, sql, SQL } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../common/current-user.decorator';
import { ADMIN_ACCESS_ROLE_KEYS } from '../common/system-roles';
import { createSimplePdf } from '../common/simple-pdf';
import {
  EmployeeVisibilityScope,
  resolveEmployeeVisibilityScope,
} from '../common/access-control';
import {
  attendanceRecords,
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
      this.sumMonthlyPayrollNetPay(normalizedMonth, visibilityCondition),
      this.departmentHeadcount(visibilityCondition),
      this.recentHires(visibilityCondition),
      this.attendanceSummary(startDate, endDate, visibilityCondition),
      this.payrollDepartmentCosts(normalizedMonth, visibilityCondition),
      this.pendingLeaveApprovals(visibilityCondition),
      this.publishedPolicyRows(),
    ]);

    return {
      accessScopeLabel: scope.label,
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
    const pdf = createSimplePdf(
      'HRFlow Operational Report',
      `Reporting month: ${normalizedMonth} | Scope: ${dashboard.accessScopeLabel}`,
      [
        {
          heading: 'Overview',
          lines: [
            `Active Employees: ${dashboard.overview.activeEmployees}`,
            `Pending Leave Requests: ${dashboard.overview.pendingLeaveRequests}`,
            `Processed Payroll Periods: ${dashboard.overview.processedPayrollPeriods}`,
            `Published Policies: ${dashboard.overview.publishedPolicies}`,
            `Monthly Net Pay: ${dashboard.overview.monthlyPayrollNetPay.toFixed(2)}`,
          ],
        },
        {
          heading: 'Department Headcount',
          lines: dashboard.departmentHeadcount.map(
            (row) => `${row.departmentName}: ${row.employeeCount} employees`,
          ),
        },
        {
          heading: 'Attendance Summary',
          lines:
            dashboard.attendanceSummary.length > 0
              ? dashboard.attendanceSummary.map(
                  (row) =>
                    `${row.fullName} (${row.employeeNumber}) - ${row.attendanceDays} attendance days, ${row.overtimeHours.toFixed(2)} overtime hours`,
                )
              : ['No attendance records found for this month.'],
        },
        {
          heading: 'Pending Leave Approvals',
          lines:
            dashboard.pendingLeaveApprovals.length > 0
              ? dashboard.pendingLeaveApprovals.map(
                  (row) =>
                    `${row.fullName} (${row.employeeNumber}) - ${row.leaveTypeName} from ${row.startDate} to ${row.endDate} for ${row.totalDays} day(s)`,
                )
              : ['No pending leave approvals.'],
        },
        {
          heading: 'Payroll Cost By Department',
          lines: dashboard.payrollDepartmentCosts.map(
            (row) =>
              `${row.departmentName}: ${row.payslipCount} payslips, total net pay ${row.totalNetPay.toFixed(2)}`,
          ),
        },
        {
          heading: 'Published Policies',
          lines:
            dashboard.publishedPolicies.length > 0
              ? dashboard.publishedPolicies.map(
                  (row) =>
                    `${row.title} (${row.category}) v${row.version} effective ${row.effectiveDate}`,
                )
              : ['No published policies found.'],
        },
      ],
    );

    return {
      fileName: `reports-${normalizedMonth}.pdf`,
      mimeType: 'application/pdf',
      contentBase64: pdf.toString('base64'),
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
      .select({ total: sql<string>`COALESCE(SUM(${payslips.netPay}), 0)::text` })
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

  private async recentHires(visibilityCondition?: SQL) {
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
      .where(visibilityCondition)
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
        attendanceDays: sql<number>`COUNT(${attendanceRecords.id})::float`,
        overtimeHours: sql<number>`COALESCE(SUM(${attendanceRecords.overtimeHours}), 0)`,
      })
      .from(employees)
      .leftJoin(
        attendanceRecords,
        and(
          eq(attendanceRecords.employeeId, employees.id),
          gte(attendanceRecords.attendanceDate, startDate),
          lte(attendanceRecords.attendanceDate, endDate),
          or(
            eq(attendanceRecords.status, 'COMPLETED'),
            eq(attendanceRecords.status, 'CLOCKED_IN'),
          ),
        ),
      )
      .where(this.combineConditions(eq(employees.isActive, true), visibilityCondition))
      .groupBy(employees.id)
      .orderBy(
        sql`COUNT(${attendanceRecords.id}) DESC`,
        sql`SUM(${attendanceRecords.overtimeHours}) DESC NULLS LAST`,
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
        totalNetPay: sql<number>`COALESCE(SUM(${payslips.netPay}), 0)`,
      })
      .from(departments)
      .leftJoin(employees, eq(employees.departmentId, departments.id))
      .leftJoin(payslips, eq(payslips.employeeId, employees.id))
      .leftJoin(
        payrollPeriods,
        and(
          eq(payrollPeriods.id, payslips.payrollPeriodId),
          eq(payrollPeriods.periodMonth, periodMonth),
        ),
      )
      .where(visibilityCondition)
      .groupBy(departments.id)
      .having(sql`COUNT(${employees.id}) > 0`)
      .orderBy(sql`COALESCE(SUM(${payslips.netPay}), 0) DESC`, asc(departments.name));
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
