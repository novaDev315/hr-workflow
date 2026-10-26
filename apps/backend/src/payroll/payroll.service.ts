import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { and, asc, desc, eq, gte, isNotNull, isNull, lte, or, sql, SQL } from 'drizzle-orm';
import { AppDrizzleDatabase, DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../common/current-user.decorator';
import {
  ACCOUNT_MANAGER_ROLE_KEYS,
} from '../common/system-roles';
import {
  CreatePayrollPeriodInput,
  DeletePayrollPeriodInput,
  MarkPayrollPeriodPaidInput,
  PayslipFilterInput,
  ProcessPayrollPeriodInput,
  UpsertEmployeeCompensationInput,
} from './payroll.types';
import {
  formatDateRange,
  formatMoney,
  formatPeriodMonth,
  humanizeStatus,
} from '../common/document-format';
import { bidiIsolate, createSimplePdf, describeNameForPdf } from '../common/simple-pdf';
import { calculatePayrollRun, PayrollEmployeeInput } from './payroll-calculator';
import { hasAccountManagerAccess } from '../common/access-control';
import {
  attendanceRecords,
  companySettings,
  employeeCompensations,
  employees as employeesTable,
  leaveRequests,
  leaveTypes,
  payrollPeriods as payrollPeriodsTable,
  payslips as payslipsTable,
  users,
} from '../database/drizzle/schema';

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
  periodStatus: string;
}

@Injectable()
export class PayrollService {
  constructor(private readonly database: DatabaseService) {}

  async employeeCompensations(currentUser: AuthenticatedUser) {
    this.assertCanManagePayroll(currentUser.roles);
    const rows = await this.database.drizzle
      .select(this.employeeCompensationSelectFields())
      .from(employeeCompensations)
      .innerJoin(employeesTable, eq(employeesTable.id, employeeCompensations.employeeId))
      .orderBy(asc(employeesTable.lastName), asc(employeesTable.firstName));

    return rows.map((row) => this.mapEmployeeCompensation(row));
  }

  async upsertEmployeeCompensation(
    currentUser: AuthenticatedUser,
    input: UpsertEmployeeCompensationInput,
  ) {
    this.assertCanManagePayroll(currentUser.roles);

    const [employee] = await this.database.drizzle
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(
        and(
          eq(employeesTable.id, input.employeeId),
          eq(employeesTable.isActive, true),
        ),
      )
      .limit(1);

    if (!employee) {
      throw new NotFoundException('Employee not found or inactive');
    }

    const effectiveFrom = input.effectiveFrom?.trim() || new Date().toISOString().slice(0, 10);
    const currencyCode = input.currencyCode?.trim().toUpperCase() || 'AED';

    const [existing] = await this.database.drizzle
      .select({ id: employeeCompensations.id })
      .from(employeeCompensations)
      .where(eq(employeeCompensations.employeeId, input.employeeId))
      .limit(1);

    if (existing) {
      await this.database.drizzle
        .update(employeeCompensations)
        .set({
          baseSalary: input.baseSalary,
          allowanceAmount: input.allowanceAmount ?? 0,
          deductionAmount: input.deductionAmount ?? 0,
          currencyCode,
          effectiveFrom,
          notes: input.notes?.trim() ?? null,
          updatedAt: sql`NOW()`,
        })
        .where(eq(employeeCompensations.employeeId, input.employeeId));

      return this.findEmployeeCompensationByEmployeeId(input.employeeId);
    }

    const [created] = await this.database.drizzle
      .insert(employeeCompensations)
      .values({
        id: randomUUID(),
        employeeId: input.employeeId,
        baseSalary: input.baseSalary,
        allowanceAmount: input.allowanceAmount ?? 0,
        deductionAmount: input.deductionAmount ?? 0,
        currencyCode,
        effectiveFrom,
        notes: input.notes?.trim() ?? null,
      })
      .returning({ id: employeeCompensations.id });

    return this.findEmployeeCompensation(created.id);
  }

  async payrollPeriods(currentUser: AuthenticatedUser) {
    this.assertCanManagePayroll(currentUser.roles);
    const rows = await this.database.drizzle
      .select(this.payrollPeriodSelectFields())
      .from(payrollPeriodsTable)
      .leftJoin(
        payslipsTable,
        eq(payslipsTable.payrollPeriodId, payrollPeriodsTable.id),
      )
      .groupBy(payrollPeriodsTable.id)
      .orderBy(desc(payrollPeriodsTable.periodMonth));

    return rows.map((row) => this.mapPayrollPeriod(row));
  }

  async createPayrollPeriod(
    currentUser: AuthenticatedUser,
    input: CreatePayrollPeriodInput,
  ) {
    this.assertCanManagePayroll(currentUser.roles);

    const { startDate, endDate } = this.getPeriodRange(input.periodMonth);
    const [existing] = await this.database.drizzle
      .select({ id: payrollPeriodsTable.id })
      .from(payrollPeriodsTable)
      .where(eq(payrollPeriodsTable.periodMonth, input.periodMonth))
      .limit(1);

    if (existing) {
      throw new ConflictException('Payroll period already exists for this month');
    }

    const [created] = await this.database.drizzle
      .insert(payrollPeriodsTable)
      .values({
        id: randomUUID(),
        periodMonth: input.periodMonth,
        startDate,
        endDate,
        status: 'OPEN',
      })
      .returning({ id: payrollPeriodsTable.id });

    return this.findPayrollPeriod(created.id);
  }

  async payrollPeriodPreview(
    currentUser: AuthenticatedUser,
    payrollPeriodId: string,
  ) {
    this.assertCanManagePayroll(currentUser.roles);

    const period = await this.getRawPayrollPeriod(payrollPeriodId);
    const run = await this.buildPayrollRun(this.database.drizzle, {
      id: period.id,
      periodMonth: period.periodMonth,
      startDate: period.startDate,
      endDate: period.endDate,
      status: period.status,
    });

    return {
      periodMonth: period.periodMonth,
      employeeCount: run.employeeCount,
      missingCompensationCount: run.missingCompensationCount,
      missingCompensationNames: run.missingCompensationNames,
      estimatedGross: run.estimatedGross,
      estimatedNet: run.estimatedNet,
      currencyCode: run.currencyCode,
      warnings: run.warnings,
    };
  }

  async processPayrollPeriod(
    currentUser: AuthenticatedUser,
    input: ProcessPayrollPeriodInput,
  ) {
    this.assertCanManagePayroll(currentUser.roles);

    const periodId = await this.database.drizzle.transaction(async (tx) => {
      // Row lock serialises Process / Mark Paid / Delete on the same period.
      const period = await this.lockPayrollPeriod(tx as unknown as AppDrizzleDatabase, input.payrollPeriodId);
      if (period.status === 'PAID') {
        throw new BadRequestException('Paid payroll periods cannot be reprocessed');
      }

      const run = await this.buildPayrollRun(tx as unknown as AppDrizzleDatabase, period);
      if (run.payslips.length === 0) {
        throw new BadRequestException(
          'At least one employee compensation profile is required before processing payroll',
        );
      }

      await tx
        .delete(payslipsTable)
        .where(eq(payslipsTable.payrollPeriodId, period.id));

      for (const payslip of run.payslips) {
        await tx.insert(payslipsTable).values({
          id: randomUUID(),
          payrollPeriodId: period.id,
          employeeId: payslip.employeeId,
          expectedWorkdays: payslip.expectedWorkdays,
          attendedDays: payslip.attendedDays,
          approvedLeaveDays: payslip.approvedLeaveDays,
          paidDays: payslip.paidDays,
          unpaidDays: payslip.unpaidDays,
          baseSalary: payslip.baseSalary,
          proratedBaseSalary: payslip.proratedBaseSalary,
          allowanceAmount: payslip.allowanceAmount,
          deductionAmount: payslip.deductionAmount,
          attendanceDeduction: payslip.attendanceDeduction,
          grossPay: payslip.grossPay,
          netPay: payslip.netPay,
          currencyCode: payslip.currencyCode,
          status: 'GENERATED',
        });
      }

      await tx
        .update(payrollPeriodsTable)
        .set({
          status: 'PROCESSED',
          processedAt: sql`NOW()`,
          updatedAt: sql`NOW()`,
        })
        .where(eq(payrollPeriodsTable.id, period.id));

      return period.id;
    });

    return this.findPayrollPeriod(periodId);
  }

  async markPayrollPeriodPaid(
    currentUser: AuthenticatedUser,
    input: MarkPayrollPeriodPaidInput,
  ) {
    this.assertCanManagePayroll(currentUser.roles);

    const periodId = await this.database.drizzle.transaction(async (tx) => {
      const period = await this.lockPayrollPeriod(tx as unknown as AppDrizzleDatabase, input.payrollPeriodId);
      if (period.status !== 'PROCESSED') {
        throw new BadRequestException('Only processed payroll periods can be marked as paid');
      }

      await tx
        .update(payrollPeriodsTable)
        .set({
          status: 'PAID',
          paidAt: sql`NOW()`,
          updatedAt: sql`NOW()`,
        })
        .where(eq(payrollPeriodsTable.id, period.id));

      await tx
        .update(payslipsTable)
        .set({ status: 'PAID' })
        .where(eq(payslipsTable.payrollPeriodId, period.id));

      return period.id;
    });

    return this.findPayrollPeriod(periodId);
  }

  async deletePayrollPeriod(
    currentUser: AuthenticatedUser,
    input: DeletePayrollPeriodInput,
  ) {
    this.assertCanManagePayroll(currentUser.roles);

    await this.database.drizzle.transaction(async (tx) => {
      const period = await this.lockPayrollPeriod(tx as unknown as AppDrizzleDatabase, input.payrollPeriodId);

      if (period.status === 'PAID') {
        throw new BadRequestException('Paid payroll periods cannot be deleted');
      }

      await tx
        .delete(payslipsTable)
        .where(eq(payslipsTable.payrollPeriodId, period.id));
      await tx
        .delete(payrollPeriodsTable)
        .where(eq(payrollPeriodsTable.id, period.id));
    });

    return true;
  }

  async payslips(currentUser: AuthenticatedUser, filter?: PayslipFilterInput) {
    const scopedEmployeeId = await this.resolveEmployeeScopeForPayslips(
      currentUser,
      filter?.employeeId,
    );

    const where: SQL[] = [];

    if (scopedEmployeeId) {
      where.push(eq(payslipsTable.employeeId, scopedEmployeeId));
    }

    // Employees only see payslips once payroll for the period is final.
    if (!this.canViewPayrollAcrossEmployees(currentUser.roles)) {
      where.push(eq(payrollPeriodsTable.status, 'PAID'));
    }

    if (filter?.payrollPeriodId) {
      where.push(eq(payslipsTable.payrollPeriodId, filter.payrollPeriodId));
    }

    const rows = await this.database.drizzle
      .select(this.payslipSelectFields())
      .from(payslipsTable)
      .innerJoin(
        payrollPeriodsTable,
        eq(payrollPeriodsTable.id, payslipsTable.payrollPeriodId),
      )
      .innerJoin(employeesTable, eq(employeesTable.id, payslipsTable.employeeId))
      .where(where.length > 0 ? and(...where) : undefined)
      .orderBy(
        desc(payrollPeriodsTable.periodMonth),
        asc(employeesTable.lastName),
        asc(employeesTable.firstName),
      );

    return rows.map((row) => this.mapPayslip(row));
  }

  async exportPayslipPdf(currentUser: AuthenticatedUser, payslipId: string) {
    const [row] = await this.database.drizzle
      .select(this.payslipExportSelectFields())
      .from(payslipsTable)
      .innerJoin(
        payrollPeriodsTable,
        eq(payrollPeriodsTable.id, payslipsTable.payrollPeriodId),
      )
      .innerJoin(employeesTable, eq(employeesTable.id, payslipsTable.employeeId))
      .where(eq(payslipsTable.id, payslipId))
      .limit(1);

    if (!row) {
      throw new NotFoundException('Payslip not found');
    }

    await this.resolveEmployeeScopeForPayslips(currentUser, row.employeeId);

    if (
      !this.canViewPayrollAcrossEmployees(currentUser.roles) &&
      row.periodStatus !== 'PAID'
    ) {
      throw new NotFoundException('Payslip not found');
    }

    const pdf = createSimplePdf(
      `${bidiIsolate(row.companyName ?? 'HRFlow Pro')} Payslip`,
      `${formatPeriodMonth(row.periodMonth)} payroll statement`,
      [
        {
          heading: 'Employee',
          lines: [
            describeNameForPdf('Name', row.employeeName, row.employeeNumber),
            `Employee Number: ${bidiIsolate(row.employeeNumber)}`,
            `Payroll Period: ${formatPeriodMonth(row.periodMonth)} (${formatDateRange(row.startDate, row.endDate)})`,
            `Status: ${humanizeStatus(row.status)}`,
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
            `Base Salary: ${formatMoney(row.baseSalary, row.currencyCode)}`,
            `Prorated Base Salary: ${formatMoney(row.proratedBaseSalary, row.currencyCode)}`,
            `Allowance Amount: ${formatMoney(row.allowanceAmount, row.currencyCode)}`,
            `Fixed Deductions: ${formatMoney(row.deductionAmount, row.currencyCode)}`,
            `Attendance Deduction: ${formatMoney(row.attendanceDeduction, row.currencyCode)}`,
            `Gross Pay: ${formatMoney(row.grossPay, row.currencyCode)}`,
            `Net Pay: ${formatMoney(row.netPay, row.currencyCode)}`,
          ],
        },
      ],
      { timeZone: row.companyTimeZone },
    );

    return {
      fileName: `payslip-${row.employeeNumber}-${row.periodMonth}.pdf`,
      mimeType: 'application/pdf',
      contentBase64: pdf.toString('base64'),
    };
  }

  private async findEmployeeCompensation(id: string) {
    const [row] = await this.database.drizzle
      .select(this.employeeCompensationSelectFields())
      .from(employeeCompensations)
      .innerJoin(employeesTable, eq(employeesTable.id, employeeCompensations.employeeId))
      .where(eq(employeeCompensations.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundException('Employee compensation not found');
    }

    return this.mapEmployeeCompensation(row);
  }

  private async findEmployeeCompensationByEmployeeId(employeeId: string) {
    const [row] = await this.database.drizzle
      .select(this.employeeCompensationSelectFields())
      .from(employeeCompensations)
      .innerJoin(employeesTable, eq(employeesTable.id, employeeCompensations.employeeId))
      .where(eq(employeeCompensations.employeeId, employeeId))
      .limit(1);

    if (!row) {
      throw new NotFoundException('Employee compensation not found');
    }

    return this.mapEmployeeCompensation(row);
  }

  private async getRawPayrollPeriod(id: string) {
    const [row] = await this.database.drizzle
      .select(this.payrollPeriodSelectFields())
      .from(payrollPeriodsTable)
      .leftJoin(
        payslipsTable,
        eq(payslipsTable.payrollPeriodId, payrollPeriodsTable.id),
      )
      .where(eq(payrollPeriodsTable.id, id))
      .groupBy(payrollPeriodsTable.id)
      .limit(1);

    if (!row) {
      throw new NotFoundException('Payroll period not found');
    }

    return row;
  }

  private async lockPayrollPeriod(tx: AppDrizzleDatabase, id: string) {
    const result = await tx.execute(sql`
      SELECT
        id,
        period_month AS "periodMonth",
        start_date::text AS "startDate",
        end_date::text AS "endDate",
        status
      FROM payroll_periods
      WHERE id = ${id}
      FOR UPDATE
    `);
    const row = result.rows[0] as
      | { id: string; periodMonth: string; startDate: string; endDate: string; status: string }
      | undefined;

    if (!row) {
      throw new NotFoundException('Payroll period not found');
    }

    return row;
  }

  /**
   * Loads employment, compensation, leave and attendance facts for a period and
   * feeds them to the pure calculator. Read-only; shared by process and preview.
   */
  private async buildPayrollRun(
    db: AppDrizzleDatabase,
    period: { id: string; periodMonth: string; startDate: string; endDate: string; status: string },
  ) {
    const cohort = await db
      .select({
        employeeId: employeesTable.id,
        employeeNumber: employeesTable.employeeNumber,
        employeeName: sql<string>`CONCAT(${employeesTable.firstName}, ' ', ${employeesTable.lastName})`,
        joinDate: sql<string>`${employeesTable.joinDate}::text`,
        exitDate: sql<string | null>`${employeesTable.exitDate}::text`,
        compensationId: employeeCompensations.id,
        baseSalary: employeeCompensations.baseSalary,
        allowanceAmount: employeeCompensations.allowanceAmount,
        deductionAmount: employeeCompensations.deductionAmount,
        currencyCode: employeeCompensations.currencyCode,
      })
      .from(employeesTable)
      .leftJoin(
        employeeCompensations,
        eq(employeeCompensations.employeeId, employeesTable.id),
      )
      .where(
        and(
          lte(employeesTable.joinDate, period.endDate),
          or(isNull(employeesTable.exitDate), gte(employeesTable.exitDate, period.startDate)),
          // Deactivated staff without an exit date are not on payroll; leavers keep
          // their final month because they carry an exit date.
          or(eq(employeesTable.isActive, true), isNotNull(employeesTable.exitDate)),
        ),
      )
      .orderBy(asc(employeesTable.lastName), asc(employeesTable.firstName));

    const attendanceRows = await db
      .select({
        employeeId: attendanceRecords.employeeId,
        days: sql<string>`COUNT(*)::text`,
      })
      .from(attendanceRecords)
      .where(
        and(
          gte(attendanceRecords.attendanceDate, period.startDate),
          lte(attendanceRecords.attendanceDate, period.endDate),
          eq(attendanceRecords.status, 'COMPLETED'),
        ),
      )
      .groupBy(attendanceRecords.employeeId);
    const attendedByEmployee = new Map(
      attendanceRows.map((row) => [row.employeeId, Number(row.days)]),
    );

    const leaveRows = await db
      .select({
        employeeId: leaveRequests.employeeId,
        startDate: sql<string>`${leaveRequests.startDate}::text`,
        endDate: sql<string>`${leaveRequests.endDate}::text`,
        isPaid: leaveTypes.isPaid,
      })
      .from(leaveRequests)
      .innerJoin(leaveTypes, eq(leaveTypes.id, leaveRequests.leaveTypeId))
      .where(
        and(
          eq(leaveRequests.status, 'APPROVED'),
          lte(leaveRequests.startDate, period.endDate),
          gte(leaveRequests.endDate, period.startDate),
        ),
      );
    const leavesByEmployee = new Map<string, typeof leaveRows>();
    for (const row of leaveRows) {
      const list = leavesByEmployee.get(row.employeeId) ?? [];
      list.push(row);
      leavesByEmployee.set(row.employeeId, list);
    }

    const compensated: PayrollEmployeeInput[] = [];
    const missing: Array<{ employeeNumber: string; employeeName: string }> = [];

    for (const row of cohort) {
      if (row.compensationId === null || row.baseSalary === null) {
        missing.push({ employeeNumber: row.employeeNumber, employeeName: row.employeeName });
        continue;
      }

      const leaves = leavesByEmployee.get(row.employeeId) ?? [];
      compensated.push({
        employeeId: row.employeeId,
        employeeNumber: row.employeeNumber,
        employeeName: row.employeeName,
        joinDate: row.joinDate,
        exitDate: row.exitDate,
        baseSalary: row.baseSalary,
        allowanceAmount: row.allowanceAmount ?? 0,
        deductionAmount: row.deductionAmount ?? 0,
        currencyCode: row.currencyCode ?? 'AED',
        approvedLeaves: leaves,
        unpaidLeaves: leaves.filter((leave) => !leave.isPaid),
        attendedDays: attendedByEmployee.get(row.employeeId) ?? 0,
      });
    }

    return calculatePayrollRun(period, compensated, missing, {
      periodStatus: period.status,
    });
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
    return hasAccountManagerAccess(roles);
  }

  private async resolveEmployeeScopeForPayslips(
    currentUser: AuthenticatedUser,
    requestedEmployeeId?: string,
  ) {
    if (this.canViewPayrollAcrossEmployees(currentUser.roles)) {
      return requestedEmployeeId?.trim() || null;
    }

    const [account] = await this.database.drizzle
      .select({ employeeId: users.employeeId })
      .from(users)
      .where(eq(users.id, currentUser.userId))
      .limit(1);

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

  private employeeCompensationSelectFields() {
    return {
      id: employeeCompensations.id,
      employeeId: employeeCompensations.employeeId,
      baseSalary: employeeCompensations.baseSalary,
      allowanceAmount: employeeCompensations.allowanceAmount,
      deductionAmount: employeeCompensations.deductionAmount,
      currencyCode: employeeCompensations.currencyCode,
      effectiveFrom: sql<string>`${employeeCompensations.effectiveFrom}::text`,
      notes: employeeCompensations.notes,
      employeeNumber: employeesTable.employeeNumber,
      employeeName: sql<string>`CONCAT(${employeesTable.firstName}, ' ', ${employeesTable.lastName})`,
    };
  }

  private payrollPeriodSelectFields() {
    return {
      id: payrollPeriodsTable.id,
      periodMonth: payrollPeriodsTable.periodMonth,
      startDate: sql<string>`${payrollPeriodsTable.startDate}::text`,
      endDate: sql<string>`${payrollPeriodsTable.endDate}::text`,
      status: payrollPeriodsTable.status,
      processedAt: sql<string | null>`${payrollPeriodsTable.processedAt}::text`,
      paidAt: sql<string | null>`${payrollPeriodsTable.paidAt}::text`,
      payslipCount: sql<number>`COUNT(${payslipsTable.id})::int`,
      totalNetPay: sql<number>`COALESCE(ROUND(SUM(${payslipsTable.netPay})::numeric, 2), 0)::float8`,
    };
  }

  private payslipSelectFields() {
    return {
      id: payslipsTable.id,
      payrollPeriodId: payslipsTable.payrollPeriodId,
      employeeId: payslipsTable.employeeId,
      periodMonth: payrollPeriodsTable.periodMonth,
      expectedWorkdays: payslipsTable.expectedWorkdays,
      attendedDays: payslipsTable.attendedDays,
      approvedLeaveDays: payslipsTable.approvedLeaveDays,
      paidDays: payslipsTable.paidDays,
      unpaidDays: payslipsTable.unpaidDays,
      baseSalary: payslipsTable.baseSalary,
      proratedBaseSalary: payslipsTable.proratedBaseSalary,
      allowanceAmount: payslipsTable.allowanceAmount,
      deductionAmount: payslipsTable.deductionAmount,
      attendanceDeduction: payslipsTable.attendanceDeduction,
      grossPay: payslipsTable.grossPay,
      netPay: payslipsTable.netPay,
      currencyCode: payslipsTable.currencyCode,
      status: payslipsTable.status,
      employeeNumber: employeesTable.employeeNumber,
      employeeName: sql<string>`CONCAT(${employeesTable.firstName}, ' ', ${employeesTable.lastName})`,
    };
  }

  private payslipExportSelectFields() {
    return {
      ...this.payslipSelectFields(),
      startDate: sql<string>`${payrollPeriodsTable.startDate}::text`,
      endDate: sql<string>`${payrollPeriodsTable.endDate}::text`,
      periodStatus: payrollPeriodsTable.status,
      companyTimeZone: sql<string | null>`(
        SELECT ${companySettings.timezone}
        FROM ${companySettings}
        WHERE ${companySettings.singletonKey} = 'default'
        LIMIT 1
      )`,
      companyName: sql<string | null>`(
        SELECT ${companySettings.companyName}
        FROM ${companySettings}
        WHERE ${companySettings.singletonKey} = 'default'
        LIMIT 1
      )`,
    };
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
