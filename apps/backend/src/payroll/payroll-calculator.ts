// Pure payroll maths shared by processing and the pre-flight preview.
// No database access here so it can be unit tested directly.
//
// Pay basis (owner decision): full pay, deduct absences. Clock-in records never
// feed pay. Paid days = working days (Mon-Fri) inside the employment window and
// the period, minus working days of approved UNPAID leave clipped to the period.

import { BadRequestException } from '@nestjs/common';
import { MAX_MONEY, moneyExceedsLimit } from '../common/money';
import { pluralize } from '../common/document-format';
import { countWorkingDays } from '../leave/leave-days';

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcMs(isoDate: string) {
  return Date.parse(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
}

function isWeekday(ms: number) {
  const day = new Date(ms).getUTCDay();
  return day !== 0 && day !== 6;
}

/** Inclusive count of Monday-Friday days between two ISO dates. */
export function countPayrollWorkingDays(startDate: string, endDate: string) {
  return countWorkingDays(startDate.slice(0, 10), endDate.slice(0, 10));
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface PayrollPeriodWindow extends DateRange {
  periodMonth?: string;
}

export interface PayrollEmployeeInput {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  joinDate: string;
  exitDate: string | null;
  baseSalary: number;
  allowanceAmount: number;
  deductionAmount: number;
  currencyCode: string;
  /** Approved leave of any type overlapping the period (used for the payslip leave-days figure). */
  approvedLeaves: DateRange[];
  /** Approved leave of UNPAID leave types overlapping the period. */
  unpaidLeaves: DateRange[];
  /** COMPLETED attendance records inside the period (informational only). */
  attendedDays: number;
}

export interface PayslipCalculation {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
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
  /** Positive amount by which fixed deductions exceeded gross (net was clamped to 0). */
  shortfall: number;
  currencyCode: string;
}

function datesWithinRanges(ranges: DateRange[], windowStart: number, windowEnd: number) {
  const days = new Set<number>();
  for (const range of ranges) {
    const start = Math.max(toUtcMs(range.startDate), windowStart);
    const end = Math.min(toUtcMs(range.endDate), windowEnd);
    for (let cursor = start; cursor <= end; cursor += DAY_MS) {
      if (isWeekday(cursor)) {
        days.add(cursor);
      }
    }
  }
  return days;
}

/** Base plus allowance must fit the numeric(14,2) payslip columns; fail readably instead of overflowing the insert. */
export function assertCompensationFitsMoneyLimit(
  employee: { employeeName?: string; employeeNumber?: string; baseSalary: number; allowanceAmount: number },
  fullPay = roundMoney(employee.baseSalary + employee.allowanceAmount),
) {
  if (moneyExceedsLimit(fullPay)) {
    const who = employee.employeeName
      ? `${employee.employeeName} (${employee.employeeNumber ?? 'unknown'}): `
      : '';
    throw new BadRequestException(
      `${who}base salary plus allowance exceeds the maximum payable amount of ${MAX_MONEY.toFixed(2)}`,
    );
  }
}

export function calculatePayslip(
  period: DateRange,
  employee: PayrollEmployeeInput,
): PayslipCalculation {
  const periodStart = toUtcMs(period.startDate);
  const periodEnd = toUtcMs(period.endDate);
  const expectedWorkdays = countPayrollWorkingDays(period.startDate, period.endDate);

  const windowStart = Math.max(periodStart, toUtcMs(employee.joinDate));
  const windowEnd = employee.exitDate
    ? Math.min(periodEnd, toUtcMs(employee.exitDate))
    : periodEnd;

  const unpaidLeaveDays = datesWithinRanges(employee.unpaidLeaves, windowStart, windowEnd);
  let employedWorkdays = 0;
  for (let cursor = windowStart; cursor <= windowEnd; cursor += DAY_MS) {
    if (isWeekday(cursor)) {
      employedWorkdays += 1;
    }
  }

  const paidDays = Math.max(employedWorkdays - unpaidLeaveDays.size, 0);
  const unpaidDays = Math.max(expectedWorkdays - paidDays, 0);
  const approvedLeaveDays = datesWithinRanges(
    employee.approvedLeaves,
    periodStart,
    periodEnd,
  ).size;

  const ratio = expectedWorkdays > 0 ? Math.min(paidDays / expectedWorkdays, 1) : 1;
  const fullPay = roundMoney(employee.baseSalary + employee.allowanceAmount);
  assertCompensationFitsMoneyLimit(employee, fullPay);
  const proratedBaseSalary = roundMoney(employee.baseSalary * ratio);
  const proratedAllowance = roundMoney(employee.allowanceAmount * ratio);
  const grossPay = roundMoney(proratedBaseSalary + proratedAllowance);
  const attendanceDeduction = roundMoney(Math.max(fullPay - grossPay, 0));
  const rawNet = roundMoney(grossPay - employee.deductionAmount);
  const netPay = Math.max(rawNet, 0);
  const shortfall = rawNet < 0 ? roundMoney(-rawNet) : 0;

  return {
    employeeId: employee.employeeId,
    employeeNumber: employee.employeeNumber,
    employeeName: employee.employeeName,
    expectedWorkdays,
    attendedDays: employee.attendedDays,
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
    shortfall,
    currencyCode: employee.currencyCode,
  };
}

export interface MissingCompensationEmployee {
  employeeNumber: string;
  employeeName: string;
}

export interface PayrollRunSummary {
  payslips: PayslipCalculation[];
  employeeCount: number;
  missingCompensationCount: number;
  missingCompensationNames: string[];
  estimatedGross: number;
  estimatedNet: number;
  currencyCode: string;
  warnings: string[];
}

export function calculatePayrollRun(
  period: DateRange,
  employees: PayrollEmployeeInput[],
  missingCompensation: MissingCompensationEmployee[],
  options: { periodStatus?: string; defaultCurrencyCode?: string } = {},
): PayrollRunSummary {
  const payslips = employees.map((employee) => calculatePayslip(period, employee));
  const warnings: string[] = [];

  if (options.periodStatus === 'PAID') {
    warnings.push('This period is already paid and cannot be processed again.');
  } else if (options.periodStatus === 'PROCESSED') {
    warnings.push(
      'This period is already processed. Processing again will replace the generated payslips.',
    );
  }

  const missingCompensationNames = missingCompensation.map(
    (row) => `${row.employeeName} (${row.employeeNumber})`,
  );
  if (missingCompensationNames.length > 0) {
    warnings.push(
      `${pluralize(missingCompensationNames.length, 'employee')} ${missingCompensationNames.length === 1 ? 'has' : 'have'} no compensation profile and will not receive a payslip: ${missingCompensationNames.join(', ')}.`,
    );
  }

  for (const payslip of payslips) {
    if (payslip.shortfall > 0) {
      warnings.push(
        `${payslip.employeeName} (${payslip.employeeNumber}): fixed deductions exceed gross pay by ${payslip.currencyCode} ${payslip.shortfall.toFixed(2)}; net pay is set to 0.`,
      );
    }
  }

  const currencyCounts = new Map<string, number>();
  for (const payslip of payslips) {
    currencyCounts.set(payslip.currencyCode, (currencyCounts.get(payslip.currencyCode) ?? 0) + 1);
  }
  const currencies = [...currencyCounts.keys()].sort();
  if (currencies.length > 1) {
    warnings.push(
      `Employees are paid in mixed currencies (${currencies.join(', ')}); the estimated totals add amounts across currencies.`,
    );
  }
  const primaryCurrency =
    [...currencyCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ??
    options.defaultCurrencyCode ??
    'AED';

  return {
    payslips,
    employeeCount: payslips.length,
    missingCompensationCount: missingCompensation.length,
    missingCompensationNames,
    estimatedGross: roundMoney(payslips.reduce((sum, row) => sum + row.grossPay, 0)),
    estimatedNet: roundMoney(payslips.reduce((sum, row) => sum + row.netPay, 0)),
    currencyCode: primaryCurrency,
    warnings,
  };
}
