import {
  calculatePayrollRun,
  calculatePayslip,
  countPayrollWorkingDays,
  PayrollEmployeeInput,
  roundMoney,
} from './payroll-calculator';

const october = { startDate: '2026-10-01', endDate: '2026-10-31' };
const september = { startDate: '2026-09-01', endDate: '2026-09-30' };

function employee(overrides: Partial<PayrollEmployeeInput> = {}): PayrollEmployeeInput {
  return {
    employeeId: 'e1',
    employeeNumber: 'EMP001',
    employeeName: 'Test Employee',
    joinDate: '2020-01-01',
    exitDate: null,
    baseSalary: 10000,
    allowanceAmount: 1000,
    deductionAmount: 500,
    currencyCode: 'AED',
    approvedLeaves: [],
    unpaidLeaves: [],
    attendedDays: 0,
    ...overrides,
  };
}

describe('payroll calculator', () => {
  it('counts Monday to Friday only', () => {
    expect(countPayrollWorkingDays(october.startDate, october.endDate)).toBe(22);
    expect(countPayrollWorkingDays('2026-10-03', '2026-10-04')).toBe(0);
  });

  it('pays the full salary for a month with no clock-ins', () => {
    const result = calculatePayslip(october, employee({ attendedDays: 0 }));

    expect(result.expectedWorkdays).toBe(22);
    expect(result.paidDays).toBe(22);
    expect(result.unpaidDays).toBe(0);
    expect(result.grossPay).toBe(11000);
    expect(result.attendanceDeduction).toBe(0);
    expect(result.netPay).toBe(10500);
  });

  it('prorates base salary and allowance for a mid-month joiner', () => {
    const result = calculatePayslip(october, employee({ joinDate: '2026-10-15' }));

    // 15,16, 19-23, 26-30 = 12 working days of 22
    expect(result.paidDays).toBe(12);
    expect(result.unpaidDays).toBe(10);
    expect(result.proratedBaseSalary).toBe(5454.55);
    expect(result.grossPay).toBe(6000);
    expect(result.attendanceDeduction).toBe(5000);
    expect(result.netPay).toBe(5500);
  });

  it('pays a leaver only up to the exit date', () => {
    const result = calculatePayslip(october, employee({ exitDate: '2026-10-09' }));

    // 1,2, 5-9 = 7 working days
    expect(result.paidDays).toBe(7);
    expect(result.grossPay).toBe(roundMoney(roundMoney((10000 * 7) / 22) + roundMoney((1000 * 7) / 22)));
    expect(result.attendanceDeduction).toBe(roundMoney(11000 - result.grossPay));
  });

  it('ignores employment outside the period', () => {
    const joinedLater = calculatePayslip(october, employee({ joinDate: '2026-11-02' }));
    expect(joinedLater.paidDays).toBe(0);
    expect(joinedLater.netPay).toBe(0);
    expect(joinedLater.shortfall).toBe(500);
  });

  it('clips unpaid leave to the period so a cross-month leave is not counted twice', () => {
    const leave = { startDate: '2026-09-21', endDate: '2026-10-09' };

    const inOctober = calculatePayslip(october, employee({ unpaidLeaves: [leave] }));
    const inSeptember = calculatePayslip(september, employee({ unpaidLeaves: [leave] }));

    // Oct 1,2,5-9 = 7 unpaid; Sep 21-25, 28-30 = 8 unpaid
    expect(inOctober.paidDays).toBe(15);
    expect(inSeptember.paidDays).toBe(14);
    expect(22 - inOctober.paidDays + (22 - inSeptember.paidDays)).toBe(15);
  });

  it('does not double count overlapping unpaid leaves or weekends', () => {
    const result = calculatePayslip(
      october,
      employee({
        unpaidLeaves: [
          { startDate: '2026-10-05', endDate: '2026-10-09' },
          { startDate: '2026-10-07', endDate: '2026-10-11' },
        ],
      }),
    );

    // 5-9 unpaid (5 weekdays); 10-11 is a weekend
    expect(result.paidDays).toBe(17);
  });

  it('applies unpaid leave only inside the employment window', () => {
    const result = calculatePayslip(
      october,
      employee({
        joinDate: '2026-10-15',
        unpaidLeaves: [{ startDate: '2026-10-01', endDate: '2026-10-20' }],
      }),
    );

    // window 15-31 = 12 days; unpaid 15,16,19,20 = 4
    expect(result.paidDays).toBe(8);
  });

  it('clamps negative net pay to zero and reports the shortfall', () => {
    const result = calculatePayslip(
      october,
      employee({ baseSalary: 1000, allowanceAmount: 0, deductionAmount: 1500 }),
    );

    expect(result.netPay).toBe(0);
    expect(result.shortfall).toBe(500);

    const run = calculatePayrollRun(october, [
      employee({ baseSalary: 1000, allowanceAmount: 0, deductionAmount: 1500 }),
    ], []);
    expect(run.warnings.join(' ')).toContain('deductions exceed gross pay by AED 500.00');
  });

  it('rounds money half-up to two decimals', () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(2.675)).toBe(2.68);
    expect(roundMoney(1234.5600000000002)).toBe(1234.56);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });

  it('summarises a run with missing compensation, replacement and mixed currencies', () => {
    const run = calculatePayrollRun(
      october,
      [employee(), employee({ employeeId: 'e2', employeeNumber: 'EMP002', currencyCode: 'USD' })],
      [{ employeeNumber: 'EMP003', employeeName: 'No Pay' }],
      { periodStatus: 'PROCESSED' },
    );

    expect(run.employeeCount).toBe(2);
    expect(run.missingCompensationCount).toBe(1);
    expect(run.missingCompensationNames).toEqual(['No Pay (EMP003)']);
    expect(run.estimatedGross).toBe(22000);
    expect(run.estimatedNet).toBe(21000);
    expect(run.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('already processed'),
        expect.stringContaining('no compensation profile'),
        expect.stringContaining('mixed currencies'),
      ]),
    );
  });
});
