import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/current-user.decorator';
import { ADMIN_ACCESS_ROLE_KEYS } from '../common/system-roles';
import { createSimplePdf } from '../common/simple-pdf';
import {
  buildEmployeeVisibilityClause,
  resolveEmployeeVisibilityScope,
} from '../common/access-control';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(currentUser: AuthenticatedUser, periodMonth?: string) {
    this.assertCanViewReports(currentUser.roles);

    const normalizedMonth = this.normalizePeriodMonth(periodMonth);
    const { startDate, endDate } = this.getPeriodRange(normalizedMonth);
    const scope = await resolveEmployeeVisibilityScope(this.prisma, currentUser);
    const buildScope = (
      initialValues: unknown[],
      columns: {
        employeeId: string;
        departmentId: string;
        supervisorId: string;
      },
    ) => {
      const values = [...initialValues];
      const clause = buildEmployeeVisibilityClause(values, scope, columns);

      return {
        values,
        predicate: clause ? ` AND ${clause}` : '',
      };
    };

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
      (() => {
        const scoped = buildScope([], {
          employeeId: 'e.id',
          departmentId: 'e.department_id',
          supervisorId: 'e.supervisor_id',
        });
        return this.prisma.one<{ count: string }>(
          `
            SELECT COUNT(*)::text AS count
            FROM employees e
            WHERE e.is_active = TRUE${scoped.predicate}
          `,
          scoped.values,
        );
      })(),
      (() => {
        const scoped = buildScope([], {
          employeeId: 'e.id',
          departmentId: 'e.department_id',
          supervisorId: 'e.supervisor_id',
        });
        return this.prisma.one<{ count: string }>(
          `
            SELECT COUNT(*)::text AS count
            FROM leave_requests lr
            INNER JOIN employees e ON e.id = lr.employee_id
            WHERE lr.status = 'PENDING'${scoped.predicate}
          `,
          scoped.values,
        );
      })(),
      (() => {
        const scoped = buildScope([], {
          employeeId: 'e.id',
          departmentId: 'e.department_id',
          supervisorId: 'e.supervisor_id',
        });
        return this.prisma.one<{ count: string }>(
          `
            SELECT COUNT(DISTINCT pp.id)::text AS count
            FROM payroll_periods pp
            INNER JOIN payslips ps ON ps.payroll_period_id = pp.id
            INNER JOIN employees e ON e.id = ps.employee_id
            WHERE pp.status IN ('PROCESSED', 'PAID')${scoped.predicate}
          `,
          scoped.values,
        );
      })(),
      this.prisma.one<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM policy_documents WHERE status = 'PUBLISHED'`,
      ),
      (() => {
        const scoped = buildScope([normalizedMonth], {
          employeeId: 'e.id',
          departmentId: 'e.department_id',
          supervisorId: 'e.supervisor_id',
        });
        return this.prisma.one<{ total: string }>(
          `
            SELECT COALESCE(SUM(ps.net_pay), 0)::text AS total
            FROM payslips ps
            INNER JOIN payroll_periods pp ON pp.id = ps.payroll_period_id
            INNER JOIN employees e ON e.id = ps.employee_id
            WHERE pp.period_month = $1${scoped.predicate}
          `,
          scoped.values,
        );
      })(),
      (() => {
        const scoped = buildScope([], {
          employeeId: 'e.id',
          departmentId: 'e.department_id',
          supervisorId: 'e.supervisor_id',
        });
        return this.prisma.many<{ departmentName: string; employeeCount: number }>(
          `
            SELECT
              d.name AS "departmentName",
              COUNT(e.id)::int AS "employeeCount"
            FROM departments d
            LEFT JOIN employees e
              ON e.department_id = d.id
              AND e.is_active = TRUE${scoped.predicate}
            GROUP BY d.id
            HAVING COUNT(e.id) > 0
            ORDER BY COUNT(e.id) DESC, d.name ASC
          `,
          scoped.values,
        );
      })(),
      (() => {
        const scoped = buildScope([], {
          employeeId: 'e.id',
          departmentId: 'e.department_id',
          supervisorId: 'e.supervisor_id',
        });
        return this.prisma.many<{
          employeeNumber: string;
          fullName: string;
          joinDate: string;
          departmentName: string;
          designationTitle: string;
        }>(
          `
            SELECT
              e.employee_number AS "employeeNumber",
              CONCAT(e.first_name, ' ', e.last_name) AS "fullName",
              e.join_date::text AS "joinDate",
              d.name AS "departmentName",
              des.title AS "designationTitle"
            FROM employees e
            INNER JOIN departments d ON d.id = e.department_id
            INNER JOIN designations des ON des.id = e.designation_id
            WHERE 1 = 1${scoped.predicate}
            ORDER BY e.join_date DESC
            LIMIT 8
          `,
          scoped.values,
        );
      })(),
      (() => {
        const scoped = buildScope([startDate, endDate], {
          employeeId: 'e.id',
          departmentId: 'e.department_id',
          supervisorId: 'e.supervisor_id',
        });
        return this.prisma.many<{
          employeeNumber: string;
          fullName: string;
          attendanceDays: number;
          overtimeHours: number;
        }>(
          `
            SELECT
              e.employee_number AS "employeeNumber",
              CONCAT(e.first_name, ' ', e.last_name) AS "fullName",
              COUNT(a.id)::float AS "attendanceDays",
              COALESCE(SUM(a.overtime_hours), 0) AS "overtimeHours"
            FROM employees e
            LEFT JOIN attendance_records a
              ON a.employee_id = e.id
              AND a.attendance_date >= $1
              AND a.attendance_date <= $2
              AND a.status IN ('COMPLETED', 'CLOCKED_IN')
            WHERE e.is_active = TRUE${scoped.predicate}
            GROUP BY e.id
            ORDER BY COUNT(a.id) DESC, SUM(a.overtime_hours) DESC NULLS LAST, e.last_name ASC
            LIMIT 10
          `,
          scoped.values,
        );
      })(),
      (() => {
        const scoped = buildScope([normalizedMonth], {
          employeeId: 'e.id',
          departmentId: 'e.department_id',
          supervisorId: 'e.supervisor_id',
        });
        return this.prisma.many<{
          departmentName: string;
          payslipCount: number;
          totalNetPay: number;
        }>(
          `
            SELECT
              d.name AS "departmentName",
              COUNT(ps.id)::int AS "payslipCount",
              COALESCE(SUM(ps.net_pay), 0) AS "totalNetPay"
            FROM departments d
            LEFT JOIN employees e
              ON e.department_id = d.id${scoped.predicate}
            LEFT JOIN payslips ps ON ps.employee_id = e.id
            LEFT JOIN payroll_periods pp
              ON pp.id = ps.payroll_period_id
              AND pp.period_month = $1
            GROUP BY d.id
            HAVING COUNT(e.id) > 0
            ORDER BY "totalNetPay" DESC, d.name ASC
          `,
          scoped.values,
        );
      })(),
      (() => {
        const scoped = buildScope([], {
          employeeId: 'e.id',
          departmentId: 'e.department_id',
          supervisorId: 'e.supervisor_id',
        });
        return this.prisma.many<{
          employeeNumber: string;
          fullName: string;
          leaveTypeName: string;
          startDate: string;
          endDate: string;
          totalDays: number;
        }>(
          `
            SELECT
              e.employee_number AS "employeeNumber",
              CONCAT(e.first_name, ' ', e.last_name) AS "fullName",
              lt.name AS "leaveTypeName",
              lr.start_date::text AS "startDate",
              lr.end_date::text AS "endDate",
              lr.total_days AS "totalDays"
            FROM leave_requests lr
            INNER JOIN employees e ON e.id = lr.employee_id
            INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
            WHERE lr.status = 'PENDING'${scoped.predicate}
            ORDER BY lr.requested_at ASC
            LIMIT 10
          `,
          scoped.values,
        );
      })(),
      this.prisma.many<{
        title: string;
        category: string;
        version: string;
        effectiveDate: string;
      }>(
        `
          SELECT
            title,
            category,
            version,
            effective_date::text AS "effectiveDate"
          FROM policy_documents
          WHERE status = 'PUBLISHED'
          ORDER BY effective_date DESC, published_at DESC NULLS LAST
          LIMIT 6
        `,
      ),
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
