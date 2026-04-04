import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { SYSTEM_ROLE_DETAILS, SystemRoleKey } from '../common/system-roles';

type GraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

describe('Mobile self-service flows', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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
  let payrollPeriodId = '';
  let payrollMonth = '';

  beforeAll(async () => {
    jest.setTimeout(30000);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);

    await ensureRole('ADMIN');
    await prisma.query(
      `
        INSERT INTO departments (id, name, code, description, is_active)
        VALUES ($1, $2, $3, $4, TRUE)
      `,
      [
        ids.departmentId,
        `Test Department ${uniqueSuffix}`,
        `DEPT_${uniqueCode}`,
        'Integration test department',
      ],
    );
    await prisma.query(
      `
        INSERT INTO designations (
          id,
          title,
          code,
          department_id,
          level,
          description,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      `,
      [
        ids.designationId,
        `Test Designation ${uniqueSuffix}`,
        `DES_${uniqueCode}`,
        ids.departmentId,
        2,
        'Integration test designation',
      ],
    );

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.query(
      `
        INSERT INTO users (
          id,
          email,
          employee_id,
          password_hash,
          first_name,
          last_name,
          is_active
        )
        VALUES ($1, $2, NULL, $3, 'Test', 'Admin', TRUE)
      `,
      [ids.adminUserId, adminEmail, passwordHash],
    );

    const adminRoleId = await getRoleId('ADMIN');
    await prisma.query(
      `
        INSERT INTO user_role_assignments (id, user_id, role_id)
        VALUES ($1, $2, $3)
      `,
      [ids.adminAssignmentId, ids.adminUserId, adminRoleId],
    );
  });

  afterAll(async () => {
    if (!prisma) {
      return;
    }

    await deleteByIds('user_role_assignments', [
      ids.adminAssignmentId,
      ...(employeeAccountId ? await getUserAssignmentIds(employeeAccountId) : []),
    ]);
    await deleteByIds('leave_requests', leaveRequestId ? [leaveRequestId] : []);
    await deleteByIds('attendance_records', [
      ids.futureAttendanceId,
      ...(employeeId ? await getAttendanceRecordIds(employeeId) : []),
    ]);
    await deleteByIds('employee_location_assignments', employeeId ? await getEmployeeLocationIds(employeeId) : []);
    await deleteByIds('payslips', payrollPeriodId ? await getPayslipIds(payrollPeriodId) : []);
    await deleteByIds('payroll_periods', payrollPeriodId ? [payrollPeriodId] : []);
    await deleteByIds('employee_compensations', employeeId ? await getCompensationIds(employeeId) : []);
    await deleteByIds('locations', locationId ? [locationId] : []);
    await deleteByIds('users', [ids.adminUserId, employeeAccountId].filter(Boolean));
    await deleteByIds('employees', employeeId ? [employeeId] : []);
    await deleteByIds('designations', [ids.designationId]);
    await deleteByIds('departments', [ids.departmentId]);

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

    const nextMonth = new Date();
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    const leaveStartDate = new Date(
      Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), 5),
    )
      .toISOString()
      .slice(0, 10);
    const leaveEndDate = new Date(
      Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), 6),
    )
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

    const leaveBalances = await graphqlRequest<{
      leaveBalances: Array<{ leaveType: { id: string }; availableDays: number }>;
    }>(
      `
        query LeaveBalances($employeeId: ID!) {
          leaveBalances(employeeId: $employeeId) {
            leaveType {
              id
            }
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

    await prisma.query(
      `
        INSERT INTO attendance_records (
          id,
          employee_id,
          location_id,
          attendance_date,
          clock_in_at,
          clock_out_at,
          clock_in_distance,
          clock_out_distance,
          clock_in_geofence_valid,
          clock_out_geofence_valid,
          total_minutes,
          total_hours,
          regular_hours,
          overtime_hours,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          0,
          0,
          TRUE,
          TRUE,
          480,
          8,
          8,
          0,
          'COMPLETED'
        )
      `,
      [
        ids.futureAttendanceId,
        employeeId,
        locationId,
        `${payrollMonth}-15`,
        `${payrollMonth}-15T08:00:00.000Z`,
        `${payrollMonth}-15T16:00:00.000Z`,
      ],
    );

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

    const payslips = await graphqlRequest<{
      payslips: Array<{
        id: string;
        employeeId: string;
        periodMonth: string;
        netPay: number;
      }>;
    }>(
      `
        query Payslips($filter: PayslipFilterInput) {
          payslips(filter: $filter) {
            id
            employeeId
            periodMonth
            netPay
          }
        }
      `,
      {
        filter: {
          payrollPeriodId,
        },
      },
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
        payslipId: (await getPayslipIds(payrollPeriodId))[0],
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
    const existing = await prisma.one<{ id: string }>(
      `SELECT id FROM roles WHERE key = $1`,
      [roleKey],
    );

    if (existing) {
      return existing.id;
    }

    const detail = SYSTEM_ROLE_DETAILS[roleKey];
    const created = await prisma.one<{ id: string }>(
      `
        INSERT INTO roles (id, key, name, description, is_system)
        VALUES ($1, $2, $3, $4, TRUE)
        RETURNING id
      `,
      [randomUUID(), roleKey, detail.name, detail.description],
    );

    return created!.id;
  }

  async function getRoleId(roleKey: SystemRoleKey) {
    const role = await prisma.one<{ id: string }>(
      `SELECT id FROM roles WHERE key = $1`,
      [roleKey],
    );

    if (!role) {
      throw new Error(`Role ${roleKey} was not created`);
    }

    return role.id;
  }

  async function getUserAssignmentIds(userId: string) {
    const rows = await prisma.many<{ id: string }>(
      `SELECT id FROM user_role_assignments WHERE user_id = $1`,
      [userId],
    );

    return rows.map((row) => row.id);
  }

  async function getAttendanceRecordIds(employeeRecordId: string) {
    const rows = await prisma.many<{ id: string }>(
      `SELECT id FROM attendance_records WHERE employee_id = $1`,
      [employeeRecordId],
    );

    return rows.map((row) => row.id);
  }

  async function getEmployeeLocationIds(employeeRecordId: string) {
    const rows = await prisma.many<{ id: string }>(
      `SELECT id FROM employee_location_assignments WHERE employee_id = $1`,
      [employeeRecordId],
    );

    return rows.map((row) => row.id);
  }

  async function getPayslipIds(periodId: string) {
    const rows = await prisma.many<{ id: string }>(
      `SELECT id FROM payslips WHERE payroll_period_id = $1`,
      [periodId],
    );

    return rows.map((row) => row.id);
  }

  async function getCompensationIds(employeeRecordId: string) {
    const rows = await prisma.many<{ id: string }>(
      `SELECT id FROM employee_compensations WHERE employee_id = $1`,
      [employeeRecordId],
    );

    return rows.map((row) => row.id);
  }

  async function deleteByIds(tableName: string, values: string[]) {
    if (values.length === 0) {
      return;
    }

    await prisma.query(`DELETE FROM ${tableName} WHERE id = ANY($1::text[])`, [values]);
  }
});
