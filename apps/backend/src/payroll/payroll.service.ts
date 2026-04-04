import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/current-user.decorator';
import {
  ACCOUNT_MANAGER_ROLE_KEYS,
  ADMIN_ACCESS_ROLE_KEYS,
} from '../common/system-roles';
import {
  CreatePayrollPeriodInput,
  MarkPayrollPeriodPaidInput,
  PayslipFilterInput,
  ProcessPayrollPeriodInput,
  UpsertEmployeeCompensationInput,
} from './payroll.types';
import { createSimplePdf } from '../common/simple-pdf';

interface EmployeeCompensationRow {
  id: string;
  employeeId: string;
  baseSalary: number;
  allowanceAmount: number;
  deductionAmount: number;
  currencyCode: string;
  effectiveFrom: string;
  notes: string | null;
  employeeNumber: string;
  employeeName: string;
}

interface PayrollPeriodRow {
  id: string;
  periodMonth: string;
  startDate: string;
  endDate: string;
  status: string;
  processedAt: string | null;
  paidAt: string | null;
  payslipCount: number | null;
  totalNetPay: number | null;
}

interface PayslipRow {
  id: string;
  payrollPeriodId: string;
  employeeId: string;
  periodMonth: string;
  expectedWorkdays: number;
  attendedDays: number;
  approvedLeaveDays: number;
  paidDays: number;
  unpaidDays: number;
  baseSalary: number;
  proratedBaseSalary: number;
  allowanceAmount: number;
  deductionAmount: number;
  attendanceDeduction: number;
  grossPay: number;
  netPay: number;
  currencyCode: string;
  status: string;
  employeeNumber: string;
  employeeName: string;
}

interface PayslipExportRow extends PayslipRow {
  startDate: string;
  endDate: string;
  companyName: string | null;
}

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  async employeeCompensations(currentUser: AuthenticatedUser) {
    this.assertCanManagePayroll(currentUser.roles);
    const rows = await this.prisma.many<EmployeeCompensationRow>(
      `
        SELECT
          ec.id,
          ec.employee_id AS "employeeId",
          ec.base_salary AS "baseSalary",
          ec.allowance_amount AS "allowanceAmount",
          ec.deduction_amount AS "deductionAmount",
          ec.currency_code AS "currencyCode",
          ec.effective_from::text AS "effectiveFrom",
          ec.notes,
          e.employee_number AS "employeeNumber",
          CONCAT(e.first_name, ' ', e.last_name) AS "employeeName"
        FROM employee_compensations ec
        INNER JOIN employees e ON e.id = ec.employee_id
        ORDER BY e.last_name ASC, e.first_name ASC
      `,
    );

    return rows.map((row) => this.mapEmployeeCompensation(row));
  }

  async upsertEmployeeCompensation(
    currentUser: AuthenticatedUser,
    input: UpsertEmployeeCompensationInput,
  ) {
    this.assertCanManagePayroll(currentUser.roles);

    const employee = await this.prisma.one<{ id: string }>(
      `SELECT id FROM employees WHERE id = $1 AND is_active = TRUE`,
      [input.employeeId],
    );

    if (!employee) {
      throw new NotFoundException('Employee not found or inactive');
    }

    const effectiveFrom = input.effectiveFrom?.trim() || new Date().toISOString().slice(0, 10);
    const currencyCode = input.currencyCode?.trim().toUpperCase() || 'AED';

    const existing = await this.prisma.one<{ id: string }>(
      `SELECT id FROM employee_compensations WHERE employee_id = $1`,
      [input.employeeId],
    );

    if (existing) {
      await this.prisma.query(
        `
          UPDATE employee_compensations
          SET
            base_salary = $2,
            allowance_amount = $3,
            deduction_amount = $4,
            currency_code = $5,
            effective_from = $6,
            notes = $7,
            updated_at = NOW()
          WHERE employee_id = $1
        `,
        [
          input.employeeId,
          input.baseSalary,
          input.allowanceAmount ?? 0,
          input.deductionAmount ?? 0,
          currencyCode,
          effectiveFrom,
          input.notes?.trim() ?? null,
        ],
      );

      return this.findEmployeeCompensationByEmployeeId(input.employeeId);
    }

    const created = await this.prisma.one<{ id: string }>(
      `
        INSERT INTO employee_compensations (
          id,
          employee_id,
          base_salary,
          allowance_amount,
          deduction_amount,
          currency_code,
          effective_from,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `,
      [
        randomUUID(),
        input.employeeId,
        input.baseSalary,
        input.allowanceAmount ?? 0,
        input.deductionAmount ?? 0,
        currencyCode,
        effectiveFrom,
        input.notes?.trim() ?? null,
      ],
    );

    return this.findEmployeeCompensation(created!.id);
  }

  async payrollPeriods(currentUser: AuthenticatedUser) {
    this.assertCanManagePayroll(currentUser.roles);
    const rows = await this.prisma.many<PayrollPeriodRow>(
      `
        SELECT
          pp.id,
          pp.period_month AS "periodMonth",
          pp.start_date::text AS "startDate",
          pp.end_date::text AS "endDate",
          pp.status,
          pp.processed_at::text AS "processedAt",
          pp.paid_at::text AS "paidAt",
          COUNT(ps.id)::int AS "payslipCount",
          COALESCE(SUM(ps.net_pay), 0) AS "totalNetPay"
        FROM payroll_periods pp
        LEFT JOIN payslips ps ON ps.payroll_period_id = pp.id
        GROUP BY pp.id
        ORDER BY pp.period_month DESC
      `,
    );

    return rows.map((row) => this.mapPayrollPeriod(row));
  }

  async createPayrollPeriod(
    currentUser: AuthenticatedUser,
    input: CreatePayrollPeriodInput,
  ) {
    this.assertCanManagePayroll(currentUser.roles);

    const { startDate, endDate } = this.getPeriodRange(input.periodMonth);
    const existing = await this.prisma.one<{ id: string }>(
      `SELECT id FROM payroll_periods WHERE period_month = $1`,
      [input.periodMonth],
    );

    if (existing) {
      throw new ConflictException('Payroll period already exists for this month');
    }

    const created = await this.prisma.one<{ id: string }>(
      `
        INSERT INTO payroll_periods (
          id,
          period_month,
          start_date,
          end_date,
          status
        )
        VALUES ($1, $2, $3, $4, 'OPEN')
        RETURNING id
      `,
      [randomUUID(), input.periodMonth, startDate, endDate],
    );

    return this.findPayrollPeriod(created!.id);
  }

  async processPayrollPeriod(
    currentUser: AuthenticatedUser,
    input: ProcessPayrollPeriodInput,
  ) {
    this.assertCanManagePayroll(currentUser.roles);

    const period = await this.getRawPayrollPeriod(input.payrollPeriodId);
    if (period.status === 'PAID') {
      throw new BadRequestException('Paid payroll periods cannot be reprocessed');
    }

    const employees = await this.prisma.many<{
      compensationId: string;
      employeeId: string;
      baseSalary: number;
      allowanceAmount: number;
      deductionAmount: number;
      currencyCode: string;
      employeeNumber: string;
      employeeName: string;
    }>(
      `
        SELECT
          ec.id AS "compensationId",
          ec.employee_id AS "employeeId",
          ec.base_salary AS "baseSalary",
          ec.allowance_amount AS "allowanceAmount",
          ec.deduction_amount AS "deductionAmount",
          ec.currency_code AS "currencyCode",
          e.employee_number AS "employeeNumber",
          CONCAT(e.first_name, ' ', e.last_name) AS "employeeName"
        FROM employee_compensations ec
        INNER JOIN employees e ON e.id = ec.employee_id
        WHERE e.is_active = TRUE
        ORDER BY e.last_name ASC, e.first_name ASC
      `,
    );

    if (employees.length === 0) {
      throw new BadRequestException(
        'At least one employee compensation profile is required before processing payroll',
      );
    }

    const expectedWorkdays = this.countWeekdays(period.startDate, period.endDate);

    await this.prisma.transaction(async (tx) => {
      await this.prisma.query(
        `
          DELETE FROM payslips
          WHERE payroll_period_id = $1
        `,
        [period.id],
        tx,
      );

      for (const employee of employees) {
        const attendance = await this.prisma.one<{ attendedDays: string }>(
          `
            SELECT COUNT(*)::text AS "attendedDays"
            FROM attendance_records
            WHERE employee_id = $1
              AND attendance_date >= $2
              AND attendance_date <= $3
              AND status IN ('COMPLETED', 'CLOCKED_IN')
          `,
          [employee.employeeId, period.startDate, period.endDate],
          tx,
        );

        const approvedLeave = await this.prisma.one<{ approvedLeaveDays: string }>(
          `
            SELECT COALESCE(SUM(total_days), 0)::text AS "approvedLeaveDays"
            FROM leave_requests
            WHERE employee_id = $1
              AND status = 'APPROVED'
              AND start_date <= $3
              AND end_date >= $2
          `,
          [employee.employeeId, period.startDate, period.endDate],
          tx,
        );

        const attendedDays = Number(attendance?.attendedDays ?? '0');
        const approvedLeaveDays = Number(approvedLeave?.approvedLeaveDays ?? '0');
        const paidDays = Number(
          Math.min(expectedWorkdays, attendedDays + approvedLeaveDays).toFixed(2),
        );
        const unpaidDays = Number(Math.max(expectedWorkdays - paidDays, 0).toFixed(2));
        const proratedBaseSalary = this.toMoney(
          expectedWorkdays > 0
            ? (employee.baseSalary * paidDays) / expectedWorkdays
            : employee.baseSalary,
        );
        const attendanceDeduction = this.toMoney(
          Math.max(employee.baseSalary - proratedBaseSalary, 0),
        );
        const grossPay = this.toMoney(employee.baseSalary + employee.allowanceAmount);
        const netPay = this.toMoney(
          Math.max(
            grossPay - employee.deductionAmount - attendanceDeduction,
            0,
          ),
        );

        await this.prisma.query(
          `
            INSERT INTO payslips (
              id,
              payroll_period_id,
              employee_id,
              expected_workdays,
              attended_days,
              approved_leave_days,
              paid_days,
              unpaid_days,
              base_salary,
              prorated_base_salary,
              allowance_amount,
              deduction_amount,
              attendance_deduction,
              gross_pay,
              net_pay,
              currency_code,
              status
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8,
              $9, $10, $11, $12, $13, $14, $15, $16, 'GENERATED'
            )
          `,
          [
            randomUUID(),
            period.id,
            employee.employeeId,
            expectedWorkdays,
            attendedDays,
            approvedLeaveDays,
            paidDays,
            unpaidDays,
            employee.baseSalary,
            proratedBaseSalary,
            employee.allowanceAmount,
            employee.deductionAmount,
            attendanceDeduction,
            grossPay,
            netPay,
            employee.currencyCode,
          ],
          tx,
        );
      }

      await this.prisma.query(
        `
          UPDATE payroll_periods
          SET
            status = 'PROCESSED',
            processed_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
        `,
        [period.id],
        tx,
      );
    });

    return this.findPayrollPeriod(period.id);
  }

  async markPayrollPeriodPaid(
    currentUser: AuthenticatedUser,
    input: MarkPayrollPeriodPaidInput,
  ) {
    this.assertCanManagePayroll(currentUser.roles);

    const period = await this.getRawPayrollPeriod(input.payrollPeriodId);
    if (period.status !== 'PROCESSED') {
      throw new BadRequestException('Only processed payroll periods can be marked as paid');
    }

    await this.prisma.transaction(async (tx) => {
      await this.prisma.query(
        `
          UPDATE payroll_periods
          SET
            status = 'PAID',
            paid_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
        `,
        [period.id],
        tx,
      );

      await this.prisma.query(
        `
          UPDATE payslips
          SET status = 'PAID'
          WHERE payroll_period_id = $1
        `,
        [period.id],
        tx,
      );
    });

    return this.findPayrollPeriod(period.id);
  }

  async payslips(currentUser: AuthenticatedUser, filter?: PayslipFilterInput) {
    const scopedEmployeeId = await this.resolveEmployeeScopeForPayslips(
      currentUser,
      filter?.employeeId,
    );

    const values: unknown[] = [];
    const where: string[] = [];

    if (scopedEmployeeId) {
      values.push(scopedEmployeeId);
      where.push(`ps.employee_id = $${values.length}`);
    }

    if (filter?.payrollPeriodId) {
      values.push(filter.payrollPeriodId);
      where.push(`ps.payroll_period_id = $${values.length}`);
    }

    const rows = await this.prisma.many<PayslipRow>(
      `
        SELECT
          ps.id,
          ps.payroll_period_id AS "payrollPeriodId",
          ps.employee_id AS "employeeId",
          pp.period_month AS "periodMonth",
          ps.expected_workdays AS "expectedWorkdays",
          ps.attended_days AS "attendedDays",
          ps.approved_leave_days AS "approvedLeaveDays",
          ps.paid_days AS "paidDays",
          ps.unpaid_days AS "unpaidDays",
          ps.base_salary AS "baseSalary",
          ps.prorated_base_salary AS "proratedBaseSalary",
          ps.allowance_amount AS "allowanceAmount",
          ps.deduction_amount AS "deductionAmount",
          ps.attendance_deduction AS "attendanceDeduction",
          ps.gross_pay AS "grossPay",
          ps.net_pay AS "netPay",
          ps.currency_code AS "currencyCode",
          ps.status,
          e.employee_number AS "employeeNumber",
          CONCAT(e.first_name, ' ', e.last_name) AS "employeeName"
        FROM payslips ps
        INNER JOIN payroll_periods pp ON pp.id = ps.payroll_period_id
        INNER JOIN employees e ON e.id = ps.employee_id
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY pp.period_month DESC, e.last_name ASC, e.first_name ASC
      `,
      values,
    );

    return rows.map((row) => this.mapPayslip(row));
  }

  async exportPayslipPdf(currentUser: AuthenticatedUser, payslipId: string) {
    const row = await this.prisma.one<PayslipExportRow>(
      `
        SELECT
          ps.id,
          ps.payroll_period_id AS "payrollPeriodId",
          ps.employee_id AS "employeeId",
          pp.period_month AS "periodMonth",
          pp.start_date::text AS "startDate",
          pp.end_date::text AS "endDate",
          ps.expected_workdays AS "expectedWorkdays",
          ps.attended_days AS "attendedDays",
          ps.approved_leave_days AS "approvedLeaveDays",
          ps.paid_days AS "paidDays",
          ps.unpaid_days AS "unpaidDays",
          ps.base_salary AS "baseSalary",
          ps.prorated_base_salary AS "proratedBaseSalary",
          ps.allowance_amount AS "allowanceAmount",
          ps.deduction_amount AS "deductionAmount",
          ps.attendance_deduction AS "attendanceDeduction",
          ps.gross_pay AS "grossPay",
          ps.net_pay AS "netPay",
          ps.currency_code AS "currencyCode",
          ps.status,
          e.employee_number AS "employeeNumber",
          CONCAT(e.first_name, ' ', e.last_name) AS "employeeName",
          (
            SELECT company_name
            FROM company_settings
            WHERE singleton_key = 'primary'
            LIMIT 1
          ) AS "companyName"
        FROM payslips ps
        INNER JOIN payroll_periods pp ON pp.id = ps.payroll_period_id
        INNER JOIN employees e ON e.id = ps.employee_id
        WHERE ps.id = $1
      `,
      [payslipId],
    );

    if (!row) {
      throw new NotFoundException('Payslip not found');
    }

    await this.resolveEmployeeScopeForPayslips(currentUser, row.employeeId);

    const pdf = createSimplePdf(
      `${row.companyName ?? 'HRFlow'} Payslip`,
      `${row.periodMonth} payroll statement`,
      [
        {
          heading: 'Employee',
          lines: [
            `Name: ${row.employeeName}`,
            `Employee Number: ${row.employeeNumber}`,
            `Payroll Period: ${row.periodMonth} (${row.startDate} to ${row.endDate})`,
            `Status: ${row.status}`,
          ],
        },
        {
          heading: 'Attendance Summary',
          lines: [
            `Expected Workdays: ${row.expectedWorkdays}`,
            `Attended Days: ${row.attendedDays}`,
            `Approved Leave Days: ${row.approvedLeaveDays}`,
            `Paid Days: ${row.paidDays}`,
            `Unpaid Days: ${row.unpaidDays}`,
          ],
        },
        {
          heading: 'Earnings And Deductions',
          lines: [
            `Base Salary: ${row.currencyCode} ${row.baseSalary.toFixed(2)}`,
            `Prorated Base Salary: ${row.currencyCode} ${row.proratedBaseSalary.toFixed(2)}`,
            `Allowance Amount: ${row.currencyCode} ${row.allowanceAmount.toFixed(2)}`,
            `Fixed Deductions: ${row.currencyCode} ${row.deductionAmount.toFixed(2)}`,
            `Attendance Deduction: ${row.currencyCode} ${row.attendanceDeduction.toFixed(2)}`,
            `Gross Pay: ${row.currencyCode} ${row.grossPay.toFixed(2)}`,
            `Net Pay: ${row.currencyCode} ${row.netPay.toFixed(2)}`,
          ],
        },
      ],
    );

    return {
      fileName: `payslip-${row.employeeNumber}-${row.periodMonth}.pdf`,
      mimeType: 'application/pdf',
      contentBase64: pdf.toString('base64'),
    };
  }

  private async findEmployeeCompensation(id: string) {
    const row = await this.prisma.one<EmployeeCompensationRow>(
      `
        SELECT
          ec.id,
          ec.employee_id AS "employeeId",
          ec.base_salary AS "baseSalary",
          ec.allowance_amount AS "allowanceAmount",
          ec.deduction_amount AS "deductionAmount",
          ec.currency_code AS "currencyCode",
          ec.effective_from::text AS "effectiveFrom",
          ec.notes,
          e.employee_number AS "employeeNumber",
          CONCAT(e.first_name, ' ', e.last_name) AS "employeeName"
        FROM employee_compensations ec
        INNER JOIN employees e ON e.id = ec.employee_id
        WHERE ec.id = $1
      `,
      [id],
    );

    if (!row) {
      throw new NotFoundException('Employee compensation not found');
    }

    return this.mapEmployeeCompensation(row);
  }

  private async findEmployeeCompensationByEmployeeId(employeeId: string) {
    const row = await this.prisma.one<EmployeeCompensationRow>(
      `
        SELECT
          ec.id,
          ec.employee_id AS "employeeId",
          ec.base_salary AS "baseSalary",
          ec.allowance_amount AS "allowanceAmount",
          ec.deduction_amount AS "deductionAmount",
          ec.currency_code AS "currencyCode",
          ec.effective_from::text AS "effectiveFrom",
          ec.notes,
          e.employee_number AS "employeeNumber",
          CONCAT(e.first_name, ' ', e.last_name) AS "employeeName"
        FROM employee_compensations ec
        INNER JOIN employees e ON e.id = ec.employee_id
        WHERE ec.employee_id = $1
      `,
      [employeeId],
    );

    if (!row) {
      throw new NotFoundException('Employee compensation not found');
    }

    return this.mapEmployeeCompensation(row);
  }

  private async getRawPayrollPeriod(id: string) {
    const row = await this.prisma.one<PayrollPeriodRow>(
      `
        SELECT
          pp.id,
          pp.period_month AS "periodMonth",
          pp.start_date::text AS "startDate",
          pp.end_date::text AS "endDate",
          pp.status,
          pp.processed_at::text AS "processedAt",
          pp.paid_at::text AS "paidAt",
          COUNT(ps.id)::int AS "payslipCount",
          COALESCE(SUM(ps.net_pay), 0) AS "totalNetPay"
        FROM payroll_periods pp
        LEFT JOIN payslips ps ON ps.payroll_period_id = pp.id
        WHERE pp.id = $1
        GROUP BY pp.id
      `,
      [id],
    );

    if (!row) {
      throw new NotFoundException('Payroll period not found');
    }

    return row;
  }

  private async findPayrollPeriod(id: string) {
    return this.mapPayrollPeriod(await this.getRawPayrollPeriod(id));
  }

  private assertCanManagePayroll(roles: string[]) {
    const hasAccess = roles.some((role) =>
      ACCOUNT_MANAGER_ROLE_KEYS.includes(
        role as (typeof ACCOUNT_MANAGER_ROLE_KEYS)[number],
      ),
    );

    if (!hasAccess) {
      throw new ForbiddenException('Only ADMIN and HR_ADMIN accounts can manage payroll');
    }
  }

  private canViewPayrollAcrossEmployees(roles: string[]) {
    return roles.some((role) =>
      ADMIN_ACCESS_ROLE_KEYS.includes(
        role as (typeof ADMIN_ACCESS_ROLE_KEYS)[number],
      ),
    );
  }

  private async resolveEmployeeScopeForPayslips(
    currentUser: AuthenticatedUser,
    requestedEmployeeId?: string,
  ) {
    if (this.canViewPayrollAcrossEmployees(currentUser.roles)) {
      return requestedEmployeeId?.trim() || null;
    }

    const account = await this.prisma.one<{ employeeId: string | null }>(
      `SELECT employee_id AS "employeeId" FROM users WHERE id = $1`,
      [currentUser.userId],
    );

    if (!account?.employeeId) {
      throw new ForbiddenException(
        'This account can sign in, but it is not linked to an employee profile',
      );
    }

    if (requestedEmployeeId?.trim() && requestedEmployeeId.trim() !== account.employeeId) {
      throw new ForbiddenException('This account can only access its own payslips');
    }

    return account.employeeId;
  }

  private getPeriodRange(periodMonth: string) {
    const [yearText, monthText] = periodMonth.split('-');
    const year = Number(yearText);
    const month = Number(monthText);

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('Payroll month must use YYYY-MM format');
    }

    const startDate = `${yearText}-${monthText}-01`;
    const end = new Date(Date.UTC(year, month, 0));
    const endDate = end.toISOString().slice(0, 10);

    return { startDate, endDate };
  }

  private countWeekdays(startDate: string, endDate: string) {
    let count = 0;
    const cursor = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);

    while (cursor <= end) {
      const day = cursor.getUTCDay();
      if (day !== 0 && day !== 6) {
        count += 1;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return count;
  }

  private toMoney(value: number) {
    return Number(value.toFixed(2));
  }

  private mapEmployeeCompensation(row: EmployeeCompensationRow) {
    return {
      id: row.id,
      employeeId: row.employeeId,
      baseSalary: row.baseSalary,
      allowanceAmount: row.allowanceAmount,
      deductionAmount: row.deductionAmount,
      currencyCode: row.currencyCode,
      effectiveFrom: row.effectiveFrom,
      notes: row.notes,
      employee: {
        id: row.employeeId,
        employeeNumber: row.employeeNumber,
        fullName: row.employeeName,
      },
    };
  }

  private mapPayrollPeriod(row: PayrollPeriodRow) {
    return {
      id: row.id,
      periodMonth: row.periodMonth,
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status,
      processedAt: row.processedAt,
      paidAt: row.paidAt,
      payslipCount: Number(row.payslipCount ?? 0),
      totalNetPay: Number(row.totalNetPay ?? 0),
    };
  }

  private mapPayslip(row: PayslipRow) {
    return {
      id: row.id,
      payrollPeriodId: row.payrollPeriodId,
      employeeId: row.employeeId,
      periodMonth: row.periodMonth,
      expectedWorkdays: row.expectedWorkdays,
      attendedDays: row.attendedDays,
      approvedLeaveDays: row.approvedLeaveDays,
      paidDays: row.paidDays,
      unpaidDays: row.unpaidDays,
      baseSalary: row.baseSalary,
      proratedBaseSalary: row.proratedBaseSalary,
      allowanceAmount: row.allowanceAmount,
      deductionAmount: row.deductionAmount,
      attendanceDeduction: row.attendanceDeduction,
      grossPay: row.grossPay,
      netPay: row.netPay,
      currencyCode: row.currencyCode,
      status: row.status,
      employee: {
        id: row.employeeId,
        employeeNumber: row.employeeNumber,
        fullName: row.employeeName,
      },
    };
  }
}
