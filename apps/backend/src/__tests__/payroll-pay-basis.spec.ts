import { ConfigModule } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { AttendanceService } from '../attendance/attendance.service';
import { AuthenticatedUser } from '../common/current-user.decorator';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import {
  attendanceRecords,
  departments,
  designations,
  employeeCompensations,
  employeeLocationAssignments,
  employees,
  leaveRequests,
  leaveTypes,
  locations,
  payrollPeriods,
  payslips,
  users,
} from '../database/drizzle/schema';
import { GeofenceService } from '../location/geofence.service';
import { LocationService } from '../location/location.service';
import { PayrollService } from '../payroll/payroll.service';
import { ReportsService } from '../reports/reports.service';
import { extractPdfTextLines } from './helpers/pdf-text';

jest.setTimeout(180000);

// March 2031: starts on a Saturday, 21 working days. April 2031: 22 working days.
const MARCH = '2031-03';
const APRIL = '2031-04';

describe('Payroll pay basis, concurrency, visibility and attendance dates', () => {
  let moduleFixture: TestingModule;
  let database: DatabaseService;
  let payroll: PayrollService;
  let reports: ReportsService;
  let attendance: AttendanceService;

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const departmentId = randomUUID();
  const designationId = randomUUID();
  const locationId = randomUUID();
  const paidLeaveTypeId = randomUUID();
  const unpaidLeaveTypeId = randomUUID();
  const adminUserId = randomUUID();
  const ids = {
    full: randomUUID(),
    leaver: randomUUID(),
    joiner: randomUUID(),
    unpaid: randomUUID(),
    paidLeave: randomUUID(),
    negative: randomUUID(),
    noComp: randomUUID(),
    supervisor: randomUUID(),
    shift: randomUUID(),
  };
  const supervisorUserId = randomUUID();
  const fullUserId = randomUUID();
  const employeeIds = Object.values(ids);

  const admin: AuthenticatedUser = {
    userId: adminUserId,
    email: `payroll.admin.${suffix}@example.test`,
    roles: ['ADMIN'],
  };
  const employeeUser: AuthenticatedUser = {
    userId: fullUserId,
    email: `payroll.full.${suffix}@example.test`,
    roles: ['EMPLOYEE'],
  };
  const supervisorUser: AuthenticatedUser = {
    userId: supervisorUserId,
    email: `payroll.supervisor.${suffix}@example.test`,
    roles: ['SUPERVISOR'],
  };

  const periodIds: string[] = [];

  async function insertEmployee(
    id: string,
    label: string,
    overrides: Partial<typeof employees.$inferInsert> = {},
  ) {
    await database.drizzle.insert(employees).values({
      id,
      employeeNumber: `PB${label}${suffix}`.slice(0, 24).toUpperCase(),
      firstName: label,
      lastName: `Payroll${suffix}`,
      email: `pb.${label}.${suffix}@example.test`.toLowerCase(),
      departmentId,
      designationId,
      employmentType: 'FULL_TIME',
      joinDate: '2020-01-01',
      status: 'ACTIVE',
      isActive: true,
      ...overrides,
    });
  }

  async function insertCompensation(
    employeeId: string,
    baseSalary: number,
    allowanceAmount: number,
    deductionAmount: number,
  ) {
    await database.drizzle.insert(employeeCompensations).values({
      id: randomUUID(),
      employeeId,
      baseSalary,
      allowanceAmount,
      deductionAmount,
      currencyCode: 'AED',
      effectiveFrom: '2020-01-01',
    });
  }

  async function createPeriod(month: string) {
    const created = await payroll.createPayrollPeriod(admin, { periodMonth: month });
    periodIds.push(created.id);
    return created.id;
  }

  async function payslipFor(periodId: string, employeeId: string) {
    const [row] = await database.drizzle
      .select()
      .from(payslips)
      .where(and(eq(payslips.payrollPeriodId, periodId), eq(payslips.employeeId, employeeId)));
    return row;
  }

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
        DatabaseModule,
      ],
      providers: [
        PayrollService,
        ReportsService,
        AttendanceService,
        LocationService,
        GeofenceService,
      ],
    }).compile();
    await moduleFixture.init();

    database = moduleFixture.get(DatabaseService);
    payroll = moduleFixture.get(PayrollService);
    reports = moduleFixture.get(ReportsService);
    attendance = moduleFixture.get(AttendanceService);

    await database.drizzle.insert(departments).values({
      id: departmentId,
      name: `Payroll Basis Dept ${suffix}`,
      code: `PB_${suffix}`.slice(0, 24).toUpperCase(),
      isActive: true,
    });
    await database.drizzle.insert(designations).values({
      id: designationId,
      title: `Payroll Basis Designation ${suffix}`,
      code: `PBD_${suffix}`.slice(0, 24).toUpperCase(),
      departmentId,
      level: 1,
      isActive: true,
    });
    await database.drizzle.insert(locations).values({
      id: locationId,
      code: `PB_LOC_${suffix}`.slice(0, 24).toUpperCase(),
      name: `Payroll Basis Location ${suffix}`,
      latitude: 25.2048,
      longitude: 55.2708,
      geofenceRadius: 100,
      address: 'Payroll basis test location',
      country: 'AE',
      isActive: true,
    });
    await database.drizzle.insert(leaveTypes).values([
      {
        id: paidLeaveTypeId,
        code: `PB_PL_${suffix}`.slice(0, 24).toUpperCase(),
        name: `PB Paid Leave ${suffix}`,
        defaultDays: 20,
        isPaid: true,
      },
      {
        id: unpaidLeaveTypeId,
        code: `PB_UL_${suffix}`.slice(0, 24).toUpperCase(),
        name: `PB Unpaid Leave ${suffix}`,
        defaultDays: 0,
        isPaid: false,
      },
    ]);

    await insertEmployee(ids.full, 'Full');
    await insertEmployee(ids.leaver, 'Leaver', { exitDate: '2031-03-12', isActive: false, status: 'INACTIVE' });
    await insertEmployee(ids.joiner, 'Joiner', { joinDate: '2031-03-17' });
    await insertEmployee(ids.unpaid, 'Unpaid');
    await insertEmployee(ids.paidLeave, 'PaidLv');
    await insertEmployee(ids.negative, 'Negative');
    await insertEmployee(ids.noComp, 'NoComp');
    await insertEmployee(ids.supervisor, 'Super');
    await insertEmployee(ids.shift, 'Shift');

    // The supervisor supervises exactly one person (the full-pay employee).
    await database.drizzle
      .update(employees)
      .set({ supervisorId: ids.supervisor })
      .where(eq(employees.id, ids.full));

    await insertCompensation(ids.full, 10000, 500, 500);
    await insertCompensation(ids.leaver, 8000, 0, 0);
    await insertCompensation(ids.joiner, 10500, 0, 0);
    await insertCompensation(ids.unpaid, 10500, 0, 0);
    await insertCompensation(ids.paidLeave, 10500, 0, 0);
    await insertCompensation(ids.negative, 1000, 0, 1500);

    await database.drizzle.insert(users).values([
      {
        id: adminUserId,
        email: admin.email,
        passwordHash: 'x',
        firstName: 'Ada',
        lastName: 'Admin',
      },
      {
        id: fullUserId,
        email: employeeUser.email,
        employeeId: ids.full,
        passwordHash: 'x',
        firstName: 'Full',
        lastName: 'Employee',
      },
      {
        id: supervisorUserId,
        email: supervisorUser.email,
        employeeId: ids.supervisor,
        passwordHash: 'x',
        firstName: 'Super',
        lastName: 'Visor',
      },
    ]);

    await database.drizzle.insert(leaveRequests).values([
      {
        id: randomUUID(),
        employeeId: ids.unpaid,
        leaveTypeId: unpaidLeaveTypeId,
        startDate: '2031-02-24',
        endDate: '2031-03-06',
        totalDays: 9,
        reason: 'Unpaid cross-month leave',
        status: 'APPROVED',
      },
      {
        id: randomUUID(),
        employeeId: ids.paidLeave,
        leaveTypeId: paidLeaveTypeId,
        startDate: '2031-02-24',
        endDate: '2031-03-06',
        totalDays: 9,
        reason: 'Paid cross-month leave',
        status: 'APPROVED',
      },
    ]);

    await database.drizzle.insert(employeeLocationAssignments).values({
      id: randomUUID(),
      employeeId: ids.shift,
      locationId,
      isPrimary: true,
      status: 'ACTIVE',
    });
  });

  afterAll(async () => {
    jest.useRealTimers();
    if (database) {
      await database.drizzle.delete(payrollPeriods).where(inArray(payrollPeriods.id, periodIds));
      await database.drizzle.delete(users).where(inArray(users.id, [adminUserId, fullUserId, supervisorUserId]));
      await database.drizzle.delete(employees).where(inArray(employees.id, employeeIds));
      await database.drizzle.delete(leaveTypes).where(inArray(leaveTypes.id, [paidLeaveTypeId, unpaidLeaveTypeId]));
      await database.drizzle.delete(locations).where(eq(locations.id, locationId));
      await database.drizzle.delete(designations).where(eq(designations.id, designationId));
      await database.drizzle.delete(departments).where(eq(departments.id, departmentId));
    }
    await moduleFixture?.close();
  });

  let marchId: string;

  it('previews, then processes a month with zero clock-ins at full pay', async () => {
    marchId = await createPeriod(MARCH);

    const preview = await payroll.payrollPeriodPreview(admin, marchId);
    expect(preview.periodMonth).toBe(MARCH);
    expect(preview.currencyCode).toBe('AED');
    expect(preview.missingCompensationNames.join(' ')).toContain(`NoComp`);
    expect(preview.missingCompensationCount).toBeGreaterThanOrEqual(1);
    expect(preview.warnings.join(' ')).toContain('no compensation profile');
    expect(preview.warnings.join(' ')).toContain('deductions exceed gross pay by AED 500.00');

    const processed = await payroll.processPayrollPeriod(admin, { payrollPeriodId: marchId });
    expect(processed.status).toBe('PROCESSED');

    const full = await payslipFor(marchId, ids.full);
    expect(full.attendedDays).toBe(0);
    expect(full.expectedWorkdays).toBe(21);
    expect(full.paidDays).toBe(21);
    expect(full.grossPay).toBe(10500);
    expect(full.attendanceDeduction).toBe(0);
    expect(full.netPay).toBe(10000);

    // Preview totals equal what processing stored.
    const [totals] = await database.drizzle
      .select({
        count: sql<number>`COUNT(*)::int`,
        gross: sql<number>`ROUND(SUM(${payslips.grossPay})::numeric, 2)::float8`,
        net: sql<number>`ROUND(SUM(${payslips.netPay})::numeric, 2)::float8`,
      })
      .from(payslips)
      .where(eq(payslips.payrollPeriodId, marchId));
    expect(preview.employeeCount).toBe(totals.count);
    expect(preview.estimatedGross).toBe(totals.gross);
    expect(preview.estimatedNet).toBe(totals.net);
  });

  it('includes a leaver, prorates a joiner and clips unpaid leave to the month', async () => {
    const leaver = await payslipFor(marchId, ids.leaver);
    expect(leaver).toBeDefined();
    expect(leaver.paidDays).toBe(8); // Mar 3-7, 10-12
    expect(leaver.grossPay).toBe(Math.round((8000 * 8 * 100) / 21) / 100);

    const joiner = await payslipFor(marchId, ids.joiner);
    expect(joiner.paidDays).toBe(11); // Mar 17-21, 24-28, 31
    expect(joiner.proratedBaseSalary).toBe(5500);
    expect(joiner.attendanceDeduction).toBe(5000);

    const unpaid = await payslipFor(marchId, ids.unpaid);
    expect(unpaid.paidDays).toBe(17); // Mar 3-6 unpaid; the Feb part is not counted
    expect(unpaid.netPay).toBe(8500);

    const paidLeave = await payslipFor(marchId, ids.paidLeave);
    expect(paidLeave.paidDays).toBe(21);
    expect(paidLeave.netPay).toBe(10500);

    const negative = await payslipFor(marchId, ids.negative);
    expect(negative.netPay).toBe(0);

    expect(await payslipFor(marchId, ids.noComp)).toBeUndefined();
  });

  it('hides GENERATED payslips from employees until the period is paid', async () => {
    const own = await payroll.payslips(employeeUser);
    expect(own.filter((row) => row.payrollPeriodId === marchId)).toHaveLength(0);

    const adminView = await payroll.payslips(admin, { payrollPeriodId: marchId, employeeId: ids.full });
    expect(adminView).toHaveLength(1);
    await expect(payroll.exportPayslipPdf(employeeUser, adminView[0].id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const adminPdf = await payroll.exportPayslipPdf(admin, adminView[0].id);
    expect(adminPdf.mimeType).toBe('application/pdf');
  });

  it('keeps department payroll cost scoped to the selected month and hides it from supervisors', async () => {
    const aprilId = await createPeriod(APRIL);
    // Two cents-style amounts whose float sum is 0.30000000000000004.
    await database.drizzle.insert(payslips).values({
      id: randomUUID(),
      payrollPeriodId: aprilId,
      employeeId: ids.full,
      expectedWorkdays: 22,
      paidDays: 22,
      baseSalary: 0.1,
      proratedBaseSalary: 0.1,
      grossPay: 0.1,
      netPay: 0.1,
      currencyCode: 'AED',
    });
    await database.drizzle.insert(payslips).values({
      id: randomUUID(),
      payrollPeriodId: aprilId,
      employeeId: ids.unpaid,
      expectedWorkdays: 22,
      paidDays: 22,
      baseSalary: 0.2,
      proratedBaseSalary: 0.2,
      grossPay: 0.2,
      netPay: 0.2,
      currencyCode: 'AED',
    });

    const deptName = `Payroll Basis Dept ${suffix}`;
    const april = await reports.dashboard(admin, APRIL);
    const aprilRow = april.payrollDepartmentCosts.find((row) => row.departmentName === deptName);
    expect(april.canViewPayroll).toBe(true);
    expect(aprilRow?.payslipCount).toBe(2);
    expect(aprilRow?.totalNetPay).toBe(0.3);

    const march = await reports.dashboard(admin, MARCH);
    const marchRow = march.payrollDepartmentCosts.find((row) => row.departmentName === deptName);
    expect(marchRow?.payslipCount).toBe(6);
    expect(marchRow?.totalNetPay).not.toBe(0.3);

    const empty = await reports.dashboard(admin, '2031-05');
    const emptyRow = empty.payrollDepartmentCosts.find((row) => row.departmentName === deptName);
    expect(emptyRow?.payslipCount).toBe(0);
    expect(emptyRow?.totalNetPay).toBe(0);

    const supervisorView = await reports.dashboard(supervisorUser, MARCH);
    expect(supervisorView.canViewPayroll).toBe(false);
    expect(supervisorView.overview.monthlyPayrollNetPay).toBe(0);
    expect(supervisorView.payrollDepartmentCosts).toEqual([]);

    const supervisorPdf = await reports.exportDashboardPdf(supervisorUser, MARCH);
    expect(Buffer.from(supervisorPdf.contentBase64, 'base64').toString('latin1')).not.toContain(
      'Payroll Cost By Department',
    );
  });

  it('limits recent hires to the 90 days ending at the selected month end', async () => {
    const marchDashboard = await reports.dashboard(admin, MARCH);
    const numbers = marchDashboard.recentHires.map((row) => row.fullName);
    expect(numbers.join(' ')).toContain('Joiner');
    expect(numbers.join(' ')).not.toContain(`Full Payroll${suffix}`);
  });

  it('counts an open clock-in as an attendance day on the report, with no hours until completed', async () => {
    const inProgress = randomUUID();
    await database.drizzle.insert(attendanceRecords).values({
      id: inProgress,
      employeeId: ids.shift,
      locationId,
      attendanceDate: '2031-03-10',
      clockInAt: new Date('2031-03-10T05:00:00Z'),
      status: 'CLOCKED_IN',
    });
    const dashboard = await reports.dashboard(admin, MARCH);
    const row = dashboard.attendanceSummary.find((entry) => entry.fullName.startsWith('Shift'));
    expect(row?.attendanceDays).toBe(1);
    expect(row?.overtimeHours).toBe(0);
    await database.drizzle.delete(attendanceRecords).where(eq(attendanceRecords.id, inProgress));
  });

  it('never lets Process overwrite a concurrent Mark Paid', async () => {
    // Hold the period row lock while flipping it to PAID, as a concurrent Mark Paid would.
    const holder = database.drizzle.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM payroll_periods WHERE id = ${marchId} FOR UPDATE`);
      await tx
        .update(payrollPeriods)
        .set({ status: 'PAID', paidAt: sql`NOW()` })
        .where(eq(payrollPeriods.id, marchId));
      await tx.update(payslips).set({ status: 'PAID' }).where(eq(payslips.payrollPeriodId, marchId));
      await new Promise((resolve) => setTimeout(resolve, 800));
    });
    await new Promise((resolve) => setTimeout(resolve, 200));

    const before = Date.now();
    await expect(
      payroll.processPayrollPeriod(admin, { payrollPeriodId: marchId }),
    ).rejects.toThrow('Paid payroll periods cannot be reprocessed');
    expect(Date.now() - before).toBeGreaterThan(300); // it waited for the lock
    await holder;

    const [period] = await database.drizzle.select().from(payrollPeriods).where(eq(payrollPeriods.id, marchId));
    expect(period.status).toBe('PAID');
    const rows = await database.drizzle.select().from(payslips).where(eq(payslips.payrollPeriodId, marchId));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.status === 'PAID')).toBe(true);
  });

  it('ends PAID when Process and Mark Paid race on a processed period', async () => {
    const racePeriod = await createPeriod('2031-06');
    await payroll.processPayrollPeriod(admin, { payrollPeriodId: racePeriod });

    await Promise.allSettled([
      payroll.processPayrollPeriod(admin, { payrollPeriodId: racePeriod }),
      payroll.markPayrollPeriodPaid(admin, { payrollPeriodId: racePeriod }),
    ]);

    const [period] = await database.drizzle.select().from(payrollPeriods).where(eq(payrollPeriods.id, racePeriod));
    expect(period.status).toBe('PAID');
    const rows = await database.drizzle.select().from(payslips).where(eq(payslips.payrollPeriodId, racePeriod));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.status === 'PAID')).toBe(true);
  });

  it('lets employees see their payslip once the period is PAID', async () => {
    const own = await payroll.payslips(employeeUser);
    expect(own.filter((row) => row.payrollPeriodId === marchId)).toHaveLength(1);
    const pdf = await payroll.exportPayslipPdf(employeeUser, own.find((row) => row.payrollPeriodId === marchId)!.id);
    expect(pdf.fileName).toContain(MARCH);

    const lines = extractPdfTextLines(pdf.contentBase64);
    // eslint-disable-next-line no-console
    expect(lines).toContain('Status: Paid');
    expect(lines).toContain('Payroll Period: March 2031 (1 – 31 Mar 2031)');
    expect(lines.some((line) => /^Generated at \d{1,2} \w{3} \d{4}, \d{2}:\d{2} \([A-Za-z_\/]+\)$/.test(line))).toBe(true);
    expect(lines.some((line) => /^Net Pay: [A-Z]{3} \d{1,3}(,\d{3})*\.\d{2}$/.test(line))).toBe(true);
    expect(lines.join('\n')).not.toMatch(/Status: PAID|\d{4}-\d{2}-\d{2}/);
  });

  describe('attendance dates in the company time zone', () => {
    const dateOnlyFakes = [
      'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame',
      'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'setImmediate',
      'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout',
    ] as const;

    afterEach(() => jest.useRealTimers());

    it('dates a 22:30 UTC clock-in on the next Dubai day and closes it after UTC midnight', async () => {
      jest.useFakeTimers({ now: new Date('2031-07-14T22:30:00Z'), doNotFake: [...dateOnlyFakes] });

      const clockIn = await attendance.clockIn(admin, {
        employeeId: ids.shift,
        locationId,
        latitude: 25.2048,
        longitude: 55.2708,
        notes: 'night shift',
      });
      expect(clockIn.attendanceDate).toBe('2031-07-15');
      expect(clockIn.clockInAt).toBe('2031-07-14T22:30:00.000Z');
      expect(clockIn.status).toBe('CLOCKED_IN');

      const [stored] = await database.drizzle
        .select({ notes: attendanceRecords.clockInNotes })
        .from(attendanceRecords)
        .where(eq(attendanceRecords.id, clockIn.id));
      expect(stored.notes).toBe('night shift | Recorded by Ada Admin');

      // Location is deactivated and the assignment released after clock-in; clock-out still works.
      await database.drizzle.update(locations).set({ isActive: false }).where(eq(locations.id, locationId));
      await database.drizzle
        .update(employeeLocationAssignments)
        .set({ status: 'RELEASED' })
        .where(eq(employeeLocationAssignments.employeeId, ids.shift));

      jest.setSystemTime(new Date('2031-07-15T01:30:00Z'));
      const clockOut = await attendance.clockOut(admin, {
        employeeId: ids.shift,
        latitude: 25.2048,
        longitude: 55.2708,
      });
      expect(clockOut.id).toBe(clockIn.id);
      expect(clockOut.status).toBe('COMPLETED');
      expect(clockOut.clockOutAt).toBe('2031-07-15T01:30:00.000Z');
      expect(clockOut.totalHours).toBe(3);

      const [after] = await database.drizzle
        .select({ notes: attendanceRecords.clockOutNotes })
        .from(attendanceRecords)
        .where(eq(attendanceRecords.id, clockIn.id));
      expect(after.notes).toBe('Recorded by Ada Admin');
    });

    it('rejects clocking out of a record older than 24 hours with an admin hint', async () => {
      await database.drizzle.update(locations).set({ isActive: true }).where(eq(locations.id, locationId));
      jest.useFakeTimers({ now: new Date('2031-08-01T08:00:00Z'), doNotFake: [...dateOnlyFakes] });
      const stale = randomUUID();
      await database.drizzle.insert(attendanceRecords).values({
        id: stale,
        employeeId: ids.shift,
        locationId,
        attendanceDate: '2031-08-01',
        clockInAt: new Date('2031-08-01T08:00:00Z'),
        status: 'CLOCKED_IN',
      });

      jest.setSystemTime(new Date('2031-08-02T09:00:00Z'));
      await expect(
        attendance.clockOut(admin, { employeeId: ids.shift, latitude: 25.2048, longitude: 55.2708 }),
      ).rejects.toThrow('older than 24 hours. Ask an admin to correct it');
    });
  });
});
