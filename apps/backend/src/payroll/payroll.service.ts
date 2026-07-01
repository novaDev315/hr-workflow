import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { and, asc, desc, eq, gte, lte, or, sql, SQL } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
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
import { createSimplePdf } from '../common/simple-pdf';
import { hasAccountManagerAccess } from '../common/access-control';
import {
  attendanceRecords,
  companySettings,
  employeeCompensations,
  employees as employeesTable,
  leaveRequests,
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

  async processPayrollPeriod(
    currentUser: AuthenticatedUser,
    input: ProcessPayrollPeriodInput,
  ) {
    this.assertCanManagePayroll(currentUser.roles);

    const period = await this.getRawPayrollPeriod(input.payrollPeriodId);
    if (period.status === 'PAID') {
      throw new BadRequestException('Paid payroll periods cannot be reprocessed');
    }

    const compensatedEmployees = await this.database.drizzle
      .select({
        compensationId: employeeCompensations.id,
        employeeId: employeeCompensations.employeeId,
        baseSalary: employeeCompensations.baseSalary,
        allowanceAmount: employeeCompensations.allowanceAmount,
        deductionAmount: employeeCompensations.deductionAmount,
        currencyCode: employeeCompensations.currencyCode,
        employeeNumber: employeesTable.employeeNumber,
        employeeName: sql<string>`CONCAT(${employeesTable.firstName}, ' ', ${employeesTable.lastName})`,
      })
      .from(employeeCompensations)
      .innerJoin(
        employeesTable,
        eq(employeesTable.id, employeeCompensations.employeeId),
      )
      .where(eq(employeesTable.isActive, true))
      .orderBy(asc(employeesTable.lastName), asc(employeesTable.firstName));

    if (compensatedEmployees.length === 0) {
      throw new BadRequestException(
        'At least one employee compensation profile is required before processing payroll',
      );
    }

    const expectedWorkdays = this.countWeekdays(period.startDate, period.endDate);

    await this.database.drizzle.transaction(async (tx) => {
      await tx
        .delete(payslipsTable)
        .where(eq(payslipsTable.payrollPeriodId, period.id));

      for (const employee of compensatedEmployees) {
        const [attendance] = await tx
          .select({
            attendedDays: sql<string>`COUNT(*)::text`,
          })
          .from(attendanceRecords)
          .where(
            and(
              eq(attendanceRecords.employeeId, employee.employeeId),
              gte(attendanceRecords.attendanceDate, period.startDate),
              lte(attendanceRecords.attendanceDate, period.endDate),
              or(
                eq(attendanceRecords.status, 'COMPLETED'),
                eq(attendanceRecords.status, 'CLOCKED_IN'),
              ),
            ),
          );

        const [approvedLeave] = await tx
          .select({
            approvedLeaveDays: sql<string>`COALESCE(SUM(${leaveRequests.totalDays}), 0)::text`,
          })
          .from(leaveRequests)
          .where(
            and(
              eq(leaveRequests.employeeId, employee.employeeId),
              eq(leaveRequests.status, 'APPROVED'),
              lte(leaveRequests.startDate, period.endDate),
              gte(leaveRequests.endDate, period.startDate),
            ),
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

        await tx.insert(payslipsTable).values({
          id: randomUUID(),
          payrollPeriodId: period.id,
          employeeId: employee.employeeId,
          expectedWorkdays,
          attendedDays,
          approvedLeaveDays,
          paidDays,
          unpaidDays,
          baseSalary: employee.baseSalary,
          proratedBaseSalary,
          allowanceAmount: employee.allowanceAmount,
          deductionAmount: employee.deductionAmount,
          attendanceDeduction,
          grossPay,
          netPay,
          currencyCode: employee.currencyCode,
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

    await this.database.drizzle.transaction(async (tx) => {
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
    });

    return this.findPayrollPeriod(period.id);
  }

  async deletePayrollPeriod(
    currentUser: AuthenticatedUser,
    input: DeletePayrollPeriodInput,
  ) {
    this.assertCanManagePayroll(currentUser.roles);
    const period = await this.getRawPayrollPeriod(input.payrollPeriodId);

    if (period.status === 'PAID') {
      throw new BadRequestException('Paid payroll periods cannot be deleted');
    }

    await this.database.drizzle.transaction(async (tx) => {
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
      totalNetPay: sql<number>`COALESCE(SUM(${payslipsTable.netPay}), 0)`,
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
      companyName: sql<string | null>`(
        SELECT ${companySettings.companyName}
        FROM ${companySettings}
        WHERE ${companySettings.singletonKey} = 'primary'
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
