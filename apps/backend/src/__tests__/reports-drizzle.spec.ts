import { ConfigModule } from '@nestjs/config';
import { TestingModule, Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';

import { AuthenticatedUser } from '../common/current-user.decorator';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import {
  attendanceRecords,
  departments,
  designations,
  employees,
  leaveRequests,
  leaveTypes,
  locations,
  payrollPeriods,
  payslips,
  policyDocuments,
} from '../database/drizzle/schema';
import { ReportsService } from '../reports/reports.service';

jest.setTimeout(180000);

describe('Reports Drizzle migration', () => {
  let moduleFixture: TestingModule;
  let database: DatabaseService;
  let reports: ReportsService;

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const month = String((Number(suffix.slice(-2)) % 12) + 1).padStart(2, '0');
  const periodMonth = `${2500 + Number(suffix.slice(-3))}-${month}`;
  const departmentId = randomUUID();
  const designationId = randomUUID();
  const employeeId = randomUUID();
  const locationId = randomUUID();
  const leaveTypeId = randomUUID();
  const leaveRequestId = randomUUID();
  const attendanceId = randomUUID();
  const payrollPeriodId = randomUUID();
  const payslipId = randomUUID();
  const policyDocumentId = randomUUID();
  const departmentName = `Reports Department ${suffix}`;
  const policyTitle = `Reports Policy ${suffix}`;
  const adminUser: AuthenticatedUser = {
    userId: `reports-admin-${suffix}`,
    email: `reports.admin.${suffix}@example.test`,
    roles: ['ADMIN'],
  };

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env', '../../.env'],
        }),
        DatabaseModule,
      ],
      providers: [ReportsService],
    }).compile();

    await moduleFixture.init();

    database = moduleFixture.get(DatabaseService);
    reports = moduleFixture.get(ReportsService);

    await database.drizzle.insert(departments).values({
      id: departmentId,
      name: departmentName,
      code: `REP_DEPT_${suffix}`.slice(0, 24).toUpperCase(),
      description: 'Reports Drizzle integration department',
      isActive: true,
    });

    await database.drizzle.insert(designations).values({
      id: designationId,
      title: `Reports Designation ${suffix}`,
      code: `REP_DES_${suffix}`.slice(0, 24).toUpperCase(),
      departmentId,
      level: 2,
      description: 'Reports Drizzle integration designation',
      isActive: true,
    });

    await database.drizzle.insert(employees).values({
      id: employeeId,
      employeeNumber: `REP${suffix}`.slice(0, 24).toUpperCase(),
      firstName: 'Reports',
      lastName: `Drizzle ${suffix}`,
      email: `reports.employee.${suffix}@example.test`,
      departmentId,
      designationId,
      employmentType: 'FULL_TIME',
      joinDate: `${periodMonth}-01`,
      status: 'ACTIVE',
      isActive: true,
    });

    await database.drizzle.insert(leaveTypes).values({
      id: leaveTypeId,
      code: `REP_LT_${suffix}`.slice(0, 24).toUpperCase(),
      name: `Reports Leave ${suffix}`,
      defaultDays: 5,
      description: 'Reports Drizzle leave type',
      isActive: true,
    });

    await database.drizzle.insert(leaveRequests).values({
      id: leaveRequestId,
      employeeId,
      leaveTypeId,
      startDate: `${periodMonth}-10`,
      endDate: `${periodMonth}-10`,
      totalDays: 1,
      reason: 'Reports Drizzle proof',
      status: 'PENDING',
    });

    await database.drizzle.insert(locations).values({
      id: locationId,
      code: `REP_LOC_${suffix}`.slice(0, 24).toUpperCase(),
      name: `Reports Location ${suffix}`,
      latitude: 25.2048,
      longitude: 55.2708,
      geofenceRadius: 100,
      address: 'Reports Drizzle integration location',
      country: 'AE',
      isActive: true,
    });

    await database.drizzle.insert(attendanceRecords).values({
      id: attendanceId,
      employeeId,
      locationId,
      attendanceDate: `${periodMonth}-11`,
      clockInAt: new Date(`${periodMonth}-11T08:00:00.000Z`),
      clockOutAt: new Date(`${periodMonth}-11T17:00:00.000Z`),
      totalMinutes: 540,
      totalHours: 9,
      regularHours: 8,
      overtimeHours: 1,
      status: 'COMPLETED',
    });

    await database.drizzle.insert(payrollPeriods).values({
      id: payrollPeriodId,
      periodMonth,
      startDate: `${periodMonth}-01`,
      endDate: `${periodMonth}-28`,
      status: 'PROCESSED',
      processedAt: new Date(),
    });

    await database.drizzle.insert(payslips).values({
      id: payslipId,
      payrollPeriodId,
      employeeId,
      expectedWorkdays: 20,
      attendedDays: 1,
      approvedLeaveDays: 0,
      paidDays: 1,
      unpaidDays: 19,
      baseSalary: 10000,
      proratedBaseSalary: 500,
      allowanceAmount: 250,
      deductionAmount: 100,
      attendanceDeduction: 9500,
      grossPay: 10250,
      netPay: 650,
      currencyCode: 'AED',
      status: 'GENERATED',
    });

    await database.drizzle.insert(policyDocuments).values({
      id: policyDocumentId,
      title: policyTitle,
      category: 'HR',
      version: '1.0',
      effectiveDate: `${periodMonth}-01`,
      description: 'Reports Drizzle policy',
      status: 'PUBLISHED',
      publishedAt: new Date(),
    });
  });

  afterAll(async () => {
    if (database) {
      await database.drizzle.delete(payslips).where(eq(payslips.id, payslipId));
      await database.drizzle
        .delete(payrollPeriods)
        .where(eq(payrollPeriods.id, payrollPeriodId));
      await database.drizzle
        .delete(attendanceRecords)
        .where(eq(attendanceRecords.id, attendanceId));
      await database.drizzle.delete(locations).where(eq(locations.id, locationId));
      await database.drizzle
        .delete(leaveRequests)
        .where(eq(leaveRequests.id, leaveRequestId));
      await database.drizzle
        .delete(leaveTypes)
        .where(eq(leaveTypes.id, leaveTypeId));
      await database.drizzle
        .delete(policyDocuments)
        .where(eq(policyDocuments.id, policyDocumentId));
      await database.drizzle.delete(employees).where(eq(employees.id, employeeId));
      await database.drizzle
        .delete(designations)
        .where(eq(designations.id, designationId));
      await database.drizzle
        .delete(departments)
        .where(eq(departments.id, departmentId));
    }

    await moduleFixture?.close();
  });

  it('builds dashboard data and report PDF through Drizzle queries', async () => {
    const dashboard = await reports.dashboard(adminUser, periodMonth);

    expect(dashboard.overview.activeEmployees).toBeGreaterThanOrEqual(1);
    expect(dashboard.overview.pendingLeaveRequests).toBeGreaterThanOrEqual(1);
    expect(dashboard.overview.processedPayrollPeriods).toBeGreaterThanOrEqual(1);
    expect(dashboard.overview.publishedPolicies).toBeGreaterThanOrEqual(1);
    expect(dashboard.departmentHeadcount.map((row) => row.departmentName)).toContain(
      departmentName,
    );
    expect(dashboard.recentHires.map((row) => row.employeeNumber)).toContain(
      `REP${suffix}`.slice(0, 24).toUpperCase(),
    );
    expect(dashboard.attendanceSummary.map((row) => row.employeeNumber)).toContain(
      `REP${suffix}`.slice(0, 24).toUpperCase(),
    );
    expect(dashboard.pendingLeaveApprovals.map((row) => row.leaveTypeName)).toContain(
      `Reports Leave ${suffix}`,
    );
    expect(dashboard.publishedPolicies.map((row) => row.title)).toContain(
      policyTitle,
    );

    const pdf = await reports.exportDashboardPdf(adminUser, periodMonth);
    expect(pdf.fileName).toBe(`reports-${periodMonth}.pdf`);
    expect(pdf.mimeType).toBe('application/pdf');
    expect(pdf.contentBase64.length).toBeGreaterThan(200);
  });
});
