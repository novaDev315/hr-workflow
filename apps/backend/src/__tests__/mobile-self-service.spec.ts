import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import { AppModule } from '../app.module';
import { SYSTEM_ROLE_DETAILS, SystemRoleKey } from '../common/system-roles';
import { DatabaseService } from '../database/database.service';
import {
  attendanceRecords as attendanceRecordsTable,
  departments,
  designations,
  employeeCompensations,
  employeeLocationAssignments,
  employees,
  leaveRequests,
  locations,
  payrollPeriods,
  payslips,
  roles,
  userRoleAssignments,
  users,
} from '../database/drizzle/schema';

type GraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

jest.setTimeout(90000);

describe('Mobile self-service flows', () => {
  let app: INestApplication;
  let database: DatabaseService;

  const ids = {
    departmentId: randomUUID(),
    designationId: randomUUID(),
    adminUserId: randomUUID(),
    adminAssignmentId: randomUUID(),
    futureAttendanceId: randomUUID(),
  };

  const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const uniqueCode = `T${uniqueSuffix}`.slice(0, 12).toUpperCase();
  const adminEmail = `admin.${uniqueSuffix}@example.test`;
  const adminPassword = 'AdminPass123!';
  const employeePassword = 'EmployeePass123!';

  let employeeId = '';
  let employeeEmail = '';
  let locationId = '';
  let employeeAccountId = '';
  let leaveRequestId = '';
  let cancelledLeaveRequestId = '';
  let payrollPeriodId = '';
  let payrollMonth = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    database = moduleFixture.get(DatabaseService);

    await ensureRole('ADMIN');
    await database.drizzle.insert(departments).values({
      id: ids.departmentId,
      name: `Test Department ${uniqueSuffix}`,
      code: `DEPT_${uniqueCode}`,
      description: 'Integration test department',
      isActive: true,
    });
    await database.drizzle.insert(designations).values({
      id: ids.designationId,
      title: `Test Designation ${uniqueSuffix}`,
      code: `DES_${uniqueCode}`,
      departmentId: ids.departmentId,
      level: 2,
      description: 'Integration test designation',
      isActive: true,
    });

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await database.drizzle.insert(users).values({
      id: ids.adminUserId,
      email: adminEmail,
      employeeId: null,
      passwordHash,
      firstName: 'Test',
      lastName: 'Admin',
      isActive: true,
    });

    const adminRoleId = await getRoleId('ADMIN');
    await database.drizzle.insert(userRoleAssignments).values({
      id: ids.adminAssignmentId,
      userId: ids.adminUserId,
      roleId: adminRoleId,
    });
  });

  afterAll(async () => {
    if (!database) {
      return;
    }

    await deleteByIds(userRoleAssignments, [
      ids.adminAssignmentId,
      ...(employeeAccountId ? await getUserAssignmentIds(employeeAccountId) : []),
    ]);
    await deleteByIds(
      leaveRequests,
      [leaveRequestId, cancelledLeaveRequestId].filter(Boolean),
    );
    await deleteByIds(attendanceRecordsTable, [
      ids.futureAttendanceId,
      ...(employeeId ? await getAttendanceRecordIds(employeeId) : []),
    ]);
    await deleteByIds(
      employeeLocationAssignments,
      employeeId ? await getEmployeeLocationIds(employeeId) : [],
    );
    await deleteByIds(
      payslips,
      payrollPeriodId ? await getPayslipIds(payrollPeriodId) : [],
    );
    await deleteByIds(payrollPeriods, payrollPeriodId ? [payrollPeriodId] : []);
    await deleteByIds(
      employeeCompensations,
      employeeId ? await getCompensationIds(employeeId) : [],
    );
    await deleteByIds(locations, locationId ? [locationId] : []);
    await deleteByIds(users, [ids.adminUserId, employeeAccountId].filter(Boolean));
    await deleteByIds(employees, employeeId ? [employeeId] : []);
    await deleteByIds(designations, [ids.designationId]);
    await deleteByIds(departments, [ids.departmentId]);

    await app.close();
  });

  it('supports employee mobile login, attendance, leave, and payslips', async () => {
    const adminSession = await graphqlRequest<{
      login: { accessToken: string };
    }>(
      `
        mutation Login($input: LoginInput!) {
          login(input: $input) {
            accessToken
          }
        }
      `,
      {
        input: {
          email: adminEmail,
          password: adminPassword,
        },
      },
    );

    const adminToken = adminSession.login.accessToken;

    const createdEmployee = await graphqlRequest<{
      createEmployee: { id: string; email: string };
    }>(
      `
        mutation CreateEmployee($input: CreateEmployeeInput!) {
          createEmployee(input: $input) {
            id
            email
          }
        }
      `,
      {
        input: {
          firstName: 'Mobile',
          lastName: 'Tester',
          email: `employee.${uniqueSuffix}@example.test`,
          phone: '+971500000000',
          departmentId: ids.departmentId,
          designationId: ids.designationId,
          employmentType: 'FULL_TIME',
          joinDate: new Date().toISOString().slice(0, 10),
        },
      },
      adminToken,
    );

    employeeId = createdEmployee.createEmployee.id;
    employeeEmail = createdEmployee.createEmployee.email;

    const createdLocation = await graphqlRequest<{
      createLocation: { id: string };
    }>(
      `
        mutation CreateLocation($input: CreateLocationInput!) {
          createLocation(input: $input) {
            id
          }
        }
      `,
      {
        input: {
          code: `LOC_${uniqueCode}`,
          name: `HQ ${uniqueSuffix}`,
          latitude: 25.2048,
          longitude: 55.2708,
          geofenceRadius: 150,
          address: 'Integration Test Office',
          city: 'Dubai',
          state: 'Dubai',
          country: 'AE',
        },
      },
      adminToken,
    );

    locationId = createdLocation.createLocation.id;

    await graphqlRequest(
      `
        mutation AssignEmployeeLocation($input: AssignEmployeeLocationInput!) {
          assignEmployeeLocation(input: $input) {
            id
            isPrimary
          }
        }
      `,
      {
        input: {
          employeeId,
          locationId,
          isPrimary: true,
        },
      },
      adminToken,
    );

    const employeeAccount = await graphqlRequest<{
      createEmployeeAccount: {
        account: { id: string; employeeId: string | null; roles: string[] };
      };
    }>(
      `
        mutation CreateEmployeeAccount($input: CreateEmployeeAccountInput!) {
          createEmployeeAccount(input: $input) {
            account {
              id
              employeeId
              roles
            }
          }
        }
      `,
      {
        input: {
          employeeId,
          password: employeePassword,
        },
      },
      adminToken,
    );

    employeeAccountId = employeeAccount.createEmployeeAccount.account.id;
    expect(employeeAccount.createEmployeeAccount.account.employeeId).toBe(employeeId);
    expect(employeeAccount.createEmployeeAccount.account.roles).toContain('EMPLOYEE');

    const employeeDirectory = await graphqlRequest<{
      employees: Array<{
        id: string;
        departmentId: string;
        linkedAccountEmail: string | null;
        linkedAccountRoles: string[];
      }>;
    }>(
      `
        query EmployeeDirectory($filter: EmployeeFilterInput) {
          employees(filter: $filter) {
            id
            departmentId
            linkedAccountEmail
            linkedAccountRoles
          }
        }
      `,
      {
        filter: {
          search: employeeEmail,
          departmentId: ids.departmentId,
          status: 'ACTIVE',
        },
      },
      adminToken,
    );

    const directoryEmployee = employeeDirectory.employees.find(
      (employee) => employee.id === employeeId,
    );

    expect(directoryEmployee).toBeDefined();
    expect(directoryEmployee?.departmentId).toBe(ids.departmentId);
    expect(directoryEmployee?.linkedAccountEmail).toBe(employeeEmail);
    expect(directoryEmployee?.linkedAccountRoles).toEqual(['EMPLOYEE']);

    const employeeSession = await graphqlRequest<{
      login: {
        accessToken: string;
        account: { employeeId: string | null; roles: string[]; email: string };
      };
    }>(
      `
        mutation Login($input: LoginInput!) {
          login(input: $input) {
            accessToken
            account {
              employeeId
              roles
              email
            }
          }
        }
      `,
      {
        input: {
          email: employeeEmail,
          password: employeePassword,
        },
      },
    );

    const employeeToken = employeeSession.login.accessToken;
    expect(employeeSession.login.account.employeeId).toBe(employeeId);
    expect(employeeSession.login.account.roles).toEqual(['EMPLOYEE']);

    const clockIn = await graphqlRequest<{
      clockIn: {
        id: string;
        status: string;
        location: { id: string };
      };
    }>(
      `
        mutation ClockIn($input: ClockInInput!) {
          clockIn(input: $input) {
            id
            status
            location {
              id
            }
          }
        }
      `,
      {
        input: {
          employeeId,
          locationId,
          latitude: 25.2048,
          longitude: 55.2708,
          notes: 'Clock in from integration test',
        },
      },
      employeeToken,
    );

    expect(clockIn.clockIn.status).toBe('CLOCKED_IN');
    expect(clockIn.clockIn.location.id).toBe(locationId);

    const clockOut = await graphqlRequest<{
      clockOut: {
        status: string;
        totalHours: number | null;
      };
    }>(
      `
        mutation ClockOut($input: ClockOutInput!) {
          clockOut(input: $input) {
            status
            totalHours
          }
        }
      `,
      {
        input: {
          employeeId,
          latitude: 25.2048,
          longitude: 55.2708,
          notes: 'Clock out from integration test',
        },
      },
      employeeToken,
    );

    expect(clockOut.clockOut.status).toBe('COMPLETED');

    const attendanceRecords = await graphqlRequest<{
      attendanceRecords: Array<{ employeeId: string; status: string }>;
    }>(
      `
        query AttendanceRecords {
          attendanceRecords {
            employeeId
            status
          }
        }
      `,
      undefined,
      employeeToken,
    );

    expect(attendanceRecords.attendanceRecords.some((record) => record.employeeId === employeeId)).toBe(
      true,
    );

    const leaveTypes = await graphqlRequest<{
      leaveTypes: Array<{ id: string; code: string }>;
    }>(
      `
        query LeaveTypes {
          leaveTypes {
            id
            code
          }
        }
      `,
      undefined,
      employeeToken,
    );

    const selectedLeaveType = leaveTypes.leaveTypes[0];
    expect(selectedLeaveType).toBeDefined();

    // Leave days now exclude weekends, so request a Monday-Tuesday (2 working days).
    const nextMonth = new Date();
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1, 1);
    const firstMonday = new Date(
      Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), 5),
    );
    while (firstMonday.getUTCDay() !== 1) {
      firstMonday.setUTCDate(firstMonday.getUTCDate() + 1);
    }
    const leaveStartDate = firstMonday.toISOString().slice(0, 10);
    const leaveEndDate = new Date(firstMonday.getTime() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const leaveRequest = await graphqlRequest<{
      requestLeave: { id: string; status: string; totalDays: number };
    }>(
      `
        mutation RequestLeave($input: RequestLeaveInput!) {
          requestLeave(input: $input) {
            id
            status
            totalDays
          }
        }
      `,
      {
        input: {
          employeeId,
          leaveTypeId: selectedLeaveType.id,
          startDate: leaveStartDate,
          endDate: leaveEndDate,
          reason: 'Integration leave request',
        },
      },
      employeeToken,
    );

    leaveRequestId = leaveRequest.requestLeave.id;
    expect(leaveRequest.requestLeave.status).toBe('PENDING');
    expect(leaveRequest.requestLeave.totalDays).toBe(2);

    const nextMonday = new Date(firstMonday.getTime() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const toCancel = await graphqlRequest<{ requestLeave: { id: string } }>(
      `
        mutation RequestLeave($input: RequestLeaveInput!) {
          requestLeave(input: $input) {
            id
          }
        }
      `,
      {
        input: {
          employeeId,
          leaveTypeId: selectedLeaveType.id,
          startDate: nextMonday,
          endDate: nextMonday,
          reason: 'Integration leave request to cancel',
        },
      },
      employeeToken,
    );
    cancelledLeaveRequestId = toCancel.requestLeave.id;

    const cancelled = await graphqlRequest<{ cancelLeaveRequest: { id: string; status: string } }>(
      `
        mutation CancelLeave($input: CancelLeaveRequestInput!) {
          cancelLeaveRequest(input: $input) {
            id
            status
          }
        }
      `,
      { input: { requestId: cancelledLeaveRequestId } },
      employeeToken,
    );
    expect(cancelled.cancelLeaveRequest).toEqual({ id: cancelledLeaveRequestId, status: 'CANCELLED' });

    const leaveBalances = await graphqlRequest<{
      leaveBalances: Array<{
        leaveType: { id: string };
        pendingDays: number;
        availableDays: number;
      }>;
    }>(
      `
        query LeaveBalances($employeeId: ID!) {
          leaveBalances(employeeId: $employeeId) {
            leaveType {
              id
            }
            pendingDays
            availableDays
          }
        }
      `,
      { employeeId },
      employeeToken,
    );

    expect(
      leaveBalances.leaveBalances.some(
        (balance) => balance.leaveType.id === selectedLeaveType.id && balance.availableDays >= 0,
      ),
    ).toBe(true);

    await graphqlRequest(
      `
        mutation UpsertEmployeeCompensation($input: UpsertEmployeeCompensationInput!) {
          upsertEmployeeCompensation(input: $input) {
            id
          }
        }
      `,
      {
        input: {
          employeeId,
          baseSalary: 9000,
          allowanceAmount: 1200,
          deductionAmount: 250,
          effectiveFrom: new Date().toISOString().slice(0, 10),
        },
      },
      adminToken,
    );

    const baseDate = new Date();
    const year = 2300 + (baseDate.getUTCFullYear() % 100);
    const month = String(baseDate.getUTCMonth() + 1).padStart(2, '0');
    payrollMonth = `${year}-${month}`;

    const createdPayrollPeriod = await graphqlRequest<{
      createPayrollPeriod: { id: string; periodMonth: string };
    }>(
      `
        mutation CreatePayrollPeriod($input: CreatePayrollPeriodInput!) {
          createPayrollPeriod(input: $input) {
            id
            periodMonth
          }
        }
      `,
      {
        input: {
          periodMonth: payrollMonth,
        },
      },
      adminToken,
    );

    payrollPeriodId = createdPayrollPeriod.createPayrollPeriod.id;

    await database.drizzle.insert(attendanceRecordsTable).values({
      id: ids.futureAttendanceId,
      employeeId,
      locationId,
      attendanceDate: `${payrollMonth}-15`,
      clockInAt: new Date(`${payrollMonth}-15T08:00:00.000Z`),
      clockOutAt: new Date(`${payrollMonth}-15T16:00:00.000Z`),
      clockInDistance: 0,
      clockOutDistance: 0,
      clockInGeofenceValid: true,
      clockOutGeofenceValid: true,
      totalMinutes: 480,
      totalHours: 8,
      regularHours: 8,
      overtimeHours: 0,
      status: 'COMPLETED',
    });

    await graphqlRequest(
      `
        mutation ProcessPayrollPeriod($input: ProcessPayrollPeriodInput!) {
          processPayrollPeriod(input: $input) {
            id
            status
          }
        }
      `,
      {
        input: {
          payrollPeriodId,
        },
      },
      adminToken,
    );

    const payslipsQuery = `
      query Payslips($filter: PayslipFilterInput) {
        payslips(filter: $filter) {
          id
          employeeId
          periodMonth
          netPay
        }
      }
    `;
    type PayslipsResult = {
      payslips: Array<{
        id: string;
        employeeId: string;
        periodMonth: string;
        netPay: number;
      }>;
    };

    // Employees only see payslips once the period is marked paid.
    const unpaidPayslips = await graphqlRequest<PayslipsResult>(
      payslipsQuery,
      { filter: { payrollPeriodId } },
      employeeToken,
    );
    expect(unpaidPayslips.payslips).toHaveLength(0);

    await graphqlRequest(
      `
        mutation MarkPayrollPeriodPaid($input: MarkPayrollPeriodPaidInput!) {
          markPayrollPeriodPaid(input: $input) {
            id
            status
          }
        }
      `,
      { input: { payrollPeriodId } },
      adminToken,
    );

    const payslips = await graphqlRequest<PayslipsResult>(
      payslipsQuery,
      { filter: { payrollPeriodId } },
      employeeToken,
    );

    expect(payslips.payslips).toHaveLength(1);
    expect(payslips.payslips[0].employeeId).toBe(employeeId);
    expect(payslips.payslips[0].periodMonth).toBe(payrollMonth);
    expect(payslips.payslips[0].netPay).toBeGreaterThan(0);
  });

  it('supports admin mobile login and PDF export endpoints', async () => {
    const adminSession = await graphqlRequest<{
      login: {
        accessToken: string;
        account: { roles: string[] };
      };
    }>(
      `
        mutation Login($input: LoginInput!) {
          login(input: $input) {
            accessToken
            account {
              roles
            }
          }
        }
      `,
      {
        input: {
          email: adminEmail,
          password: adminPassword,
        },
      },
    );

    const adminToken = adminSession.login.accessToken;
    expect(adminSession.login.account.roles).toContain('ADMIN');

    const employeeSession = await graphqlRequest<{
      login: {
        accessToken: string;
      };
    }>(
      `
        mutation Login($input: LoginInput!) {
          login(input: $input) {
            accessToken
          }
        }
      `,
      {
        input: {
          email: employeeEmail,
          password: employeePassword,
        },
      },
    );

    const employeeToken = employeeSession.login.accessToken;

    const payslipPdf = await graphqlRequest<{
      exportPayslipPdf: {
        fileName: string;
        mimeType: string;
        contentBase64: string;
      };
    }>(
      `
        query ExportPayslipPdf($payslipId: String!) {
          exportPayslipPdf(payslipId: $payslipId) {
            fileName
            mimeType
            contentBase64
          }
        }
      `,
      {
        payslipId: (await getPayslipIds(payrollPeriodId, employeeId))[0],
      },
      employeeToken,
    );

    expect(payslipPdf.exportPayslipPdf.fileName).toMatch(/^payslip-.*\.pdf$/);
    expect(payslipPdf.exportPayslipPdf.mimeType).toBe('application/pdf');
    expect(payslipPdf.exportPayslipPdf.contentBase64.length).toBeGreaterThan(200);

    const reportsPdf = await graphqlRequest<{
      exportReportsPdf: {
        fileName: string;
        mimeType: string;
        contentBase64: string;
      };
    }>(
      `
        query ExportReportsPdf($periodMonth: String) {
          exportReportsPdf(periodMonth: $periodMonth) {
            fileName
            mimeType
            contentBase64
          }
        }
      `,
      {
        periodMonth: payrollMonth,
      },
      adminToken,
    );

    expect(reportsPdf.exportReportsPdf.fileName).toBe(`reports-${payrollMonth}.pdf`);
    expect(reportsPdf.exportReportsPdf.mimeType).toBe('application/pdf');
    expect(reportsPdf.exportReportsPdf.contentBase64.length).toBeGreaterThan(200);
  });

  async function graphqlRequest<T>(
    query: string,
    variables?: Record<string, unknown>,
    token?: string,
  ) {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set(token ? { Authorization: `Bearer ${token}` } : {})
      .send({ query, variables })
      .expect(200);

    const body = response.body as GraphqlResponse<T>;
    if (body.errors?.length) {
      throw new Error(body.errors.map((error) => error.message).join('\n'));
    }

    if (!body.data) {
      throw new Error('GraphQL response did not return data');
    }

    return body.data;
  }

  async function ensureRole(roleKey: SystemRoleKey) {
    const [existing] = await database.drizzle
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.key, roleKey));

    if (existing) {
      return existing.id;
    }

    const detail = SYSTEM_ROLE_DETAILS[roleKey];
    const [created] = await database.drizzle
      .insert(roles)
      .values({
        id: randomUUID(),
        key: roleKey,
        name: detail.name,
        description: detail.description,
        isSystem: true,
      })
      .returning({ id: roles.id });

    return created!.id;
  }

  async function getRoleId(roleKey: SystemRoleKey) {
    const [role] = await database.drizzle
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.key, roleKey));

    if (!role) {
      throw new Error(`Role ${roleKey} was not created`);
    }

    return role.id;
  }

  async function getUserAssignmentIds(userId: string) {
    const rows = await database.drizzle
      .select({ id: userRoleAssignments.id })
      .from(userRoleAssignments)
      .where(eq(userRoleAssignments.userId, userId));

    return rows.map((row) => row.id);
  }

  async function getAttendanceRecordIds(employeeRecordId: string) {
    const rows = await database.drizzle
      .select({ id: attendanceRecordsTable.id })
      .from(attendanceRecordsTable)
      .where(eq(attendanceRecordsTable.employeeId, employeeRecordId));

    return rows.map((row) => row.id);
  }

  async function getEmployeeLocationIds(employeeRecordId: string) {
    const rows = await database.drizzle
      .select({ id: employeeLocationAssignments.id })
      .from(employeeLocationAssignments)
      .where(eq(employeeLocationAssignments.employeeId, employeeRecordId));

    return rows.map((row) => row.id);
  }

  async function getPayslipIds(periodId: string, employeeRecordId?: string) {
    const filters = employeeRecordId
      ? and(
          eq(payslips.payrollPeriodId, periodId),
          eq(payslips.employeeId, employeeRecordId),
        )
      : eq(payslips.payrollPeriodId, periodId);
    const rows = await database.drizzle
      .select({ id: payslips.id })
      .from(payslips)
      .where(filters)
      .orderBy(asc(payslips.id));

    return rows.map((row) => row.id);
  }

  async function getCompensationIds(employeeRecordId: string) {
    const rows = await database.drizzle
      .select({ id: employeeCompensations.id })
      .from(employeeCompensations)
      .where(eq(employeeCompensations.employeeId, employeeRecordId));

    return rows.map((row) => row.id);
  }

  async function deleteByIds(table: any, values: string[]) {
    if (values.length === 0) {
      return;
    }

    await database.drizzle.delete(table).where(inArray(table.id, values));
  }
});
