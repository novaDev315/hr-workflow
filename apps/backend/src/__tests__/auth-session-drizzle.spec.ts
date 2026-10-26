import { BadRequestException, INestApplication, ValidationError, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import { AppModule } from '../app.module';
import { ensureSystemRole } from '../auth/bootstrap-admin';
import { formatValidationErrors } from '../auth/runtime-config';
import { SystemRoleKey } from '../common/system-roles';
import { DatabaseService } from '../database/database.service';
import {
  departments,
  designations,
  employees,
  roles,
  userRoleAssignments,
  users,
} from '../database/drizzle/schema';

type GqlResponse = { data?: any; errors?: Array<{ message: string; extensions?: { code?: string } }> };

jest.setTimeout(90000);

describe('Auth session, role and login hardening', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let previousSecret: string | undefined;

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const password = 'SessionPass123!';
  const departmentId = randomUUID();
  const designationId = randomUUID();
  const createdUserIds: string[] = [];
  const createdEmployeeIds: string[] = [];

  const emailFor = (label: string) => `${label}.${suffix}@example.test`;

  async function createUser(label: string, roleKeys: SystemRoleKey[], employeeId: string | null = null) {
    const id = randomUUID();
    await database.drizzle.insert(users).values({
      id,
      email: emailFor(label),
      employeeId,
      passwordHash: await bcrypt.hash(password, 4),
      firstName: label,
      lastName: 'Tester',
    });
    for (const key of roleKeys) {
      const role = await ensureSystemRole(key, database.drizzle);
      await database.drizzle
        .insert(userRoleAssignments)
        .values({ id: randomUUID(), userId: id, roleId: role.id });
    }
    createdUserIds.push(id);
    return { id, email: emailFor(label) };
  }

  async function createEmployee(label: string) {
    const id = randomUUID();
    await database.drizzle.insert(employees).values({
      id,
      employeeNumber: `E${suffix}${createdEmployeeIds.length}`.slice(0, 20),
      firstName: label,
      lastName: 'Employee',
      email: emailFor(`emp-${label}`),
      departmentId,
      designationId,
      joinDate: '2026-01-01',
    });
    createdEmployeeIds.push(id);
    return id;
  }

  async function gql(query: string, variables?: object, token?: string): Promise<GqlResponse> {
    const req = request(app.getHttpServer()).post('/graphql').send({ query, variables });
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return (await req).body;
  }

  const LOGIN = `mutation($input: LoginInput!) { login(input: $input) { accessToken account { id roles } } }`;
  const ME = `query { me { id roles } }`;
  const LOGOUT = `mutation { logout }`;
  const PROVISION = `mutation($input: ProvisionStaffAccessInput!) { provisionStaffAccess(input: $input) { id roles } }`;

  const REVOKE = `mutation($input: RevokeStaffAccessInput!) { revokeStaffAccess(input: $input) { id roles } }`;

  async function login(email: string, pass = password) {
    return gql(LOGIN, { input: { email, password: pass } });
  }

  async function tokenFor(email: string) {
    const result = await login(email);
    expect(result.errors).toBeUndefined();
    return result.data.login.accessToken as string;
  }

  beforeAll(async () => {
    previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret-0123456789abcdef';

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        exceptionFactory: (errors: ValidationError[]) =>
          new BadRequestException(formatValidationErrors(errors)),
      }),
    );
    await app.init();
    database = moduleFixture.get(DatabaseService);

    await database.drizzle.insert(departments).values({
      id: departmentId,
      name: `Auth Dept ${suffix}`,
      code: `AUTH_${suffix}`,
    });
    await database.drizzle.insert(designations).values({
      id: designationId,
      title: `Auth Designation ${suffix}`,
      code: `AUTHD_${suffix}`,
      departmentId,
    });
  });

  afterAll(async () => {
    if (database) {
      if (createdUserIds.length) {
        await database.drizzle
          .delete(userRoleAssignments)
          .where(inArray(userRoleAssignments.userId, createdUserIds));
        await database.drizzle.delete(users).where(inArray(users.id, createdUserIds));
      }
      // Accounts provisioned through the API are linked to the employees.
      for (const employeeId of createdEmployeeIds) {
        const linked = await database.drizzle
          .select({ id: users.id })
          .from(users)
          .where(eq(users.employeeId, employeeId));
        if (linked.length) {
          const ids = linked.map((row) => row.id);
          await database.drizzle.delete(userRoleAssignments).where(inArray(userRoleAssignments.userId, ids));
          await database.drizzle.delete(users).where(inArray(users.id, ids));
        }
      }
      if (createdEmployeeIds.length) {
        await database.drizzle.delete(employees).where(inArray(employees.id, createdEmployeeIds));
      }
      await database.drizzle.delete(designations).where(eq(designations.id, designationId));
      await database.drizzle.delete(departments).where(eq(departments.id, departmentId));
    }

    await app?.close();
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
  });

  it('issues a token carrying the session version and authenticates it', async () => {
    const user = await createUser('basic', ['EMPLOYEE']);
    const token = await tokenFor(user.email);
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

    expect(payload.ver).toBe(0);
    const me = await gql(ME, undefined, token);
    expect(me.errors).toBeUndefined();
    expect(me.data.me.id).toBe(user.id);
  });

  it('rejects the existing token of a deactivated user', async () => {
    const user = await createUser('deactivated', ['EMPLOYEE']);
    const token = await tokenFor(user.email);

    await database.drizzle.update(users).set({ isActive: false }).where(eq(users.id, user.id));

    const me = await gql(ME, undefined, token);
    expect(me.data).toBeNull();
    expect(me.errors?.[0].message).toMatch(/Invalid or expired session|Unauthorized/);
  });

  it('reveals inactivity only with the correct password', async () => {
    const user = await createUser('inactive-login', ['EMPLOYEE']);
    await database.drizzle.update(users).set({ isActive: false }).where(eq(users.id, user.id));

    const wrong = await login(user.email, 'WrongPass123!');
    expect(wrong.errors?.[0].message).toBe('Invalid credentials');

    const unknown = await login(emailFor('nobody'), password);
    expect(unknown.errors?.[0].message).toBe('Invalid credentials');

    const correct = await login(user.email);
    expect(correct.errors?.[0].message).toBe('User account is inactive');
  });

  it('logout invalidates every outstanding token of the user', async () => {
    const user = await createUser('logout', ['EMPLOYEE']);
    const first = await tokenFor(user.email);
    const second = await tokenFor(user.email);

    expect((await gql(ME, undefined, first)).errors).toBeUndefined();
    expect((await gql(LOGOUT, undefined, first)).data.logout).toBe(true);

    expect((await gql(ME, undefined, first)).errors?.[0].message).toMatch(/Invalid or expired session|Unauthorized/);
    expect((await gql(ME, undefined, second)).errors?.[0].message).toMatch(/Invalid or expired session|Unauthorized/);

    const fresh = await tokenFor(user.email);
    expect((await gql(ME, undefined, fresh)).errors).toBeUndefined();
  });

  it('takes roles from the database, not from the token', async () => {
    const user = await createUser('roles', ['EMPLOYEE']);
    const token = await tokenFor(user.email);
    const role = await ensureSystemRole('HR_ADMIN', database.drizzle);
    await database.drizzle
      .insert(userRoleAssignments)
      .values({ id: randomUUID(), userId: user.id, roleId: role.id });

    const me = await gql(ME, undefined, token);
    expect(me.data.me.roles).toEqual(expect.arrayContaining(['EMPLOYEE', 'HR_ADMIN']));
  });

  it('lets only ADMIN grant ADMIN and HR_ADMIN; HR_ADMIN may grant MANAGER and SUPERVISOR', async () => {
    const hr = await createUser('hr', ['EMPLOYEE', 'HR_ADMIN']);
    const admin = await createUser('admin', ['EMPLOYEE', 'ADMIN']);
    const hrToken = await tokenFor(hr.email);
    const adminToken = await tokenFor(admin.email);

    const employeeId = await createEmployee('grant');
    const provision = (roleKey: string, token: string) =>
      gql(PROVISION, { input: { employeeId, roleKey, password } }, token);

    for (const forbidden of ['ADMIN', 'HR_ADMIN']) {
      const denied = await provision(forbidden, hrToken);
      expect(denied.errors?.[0].message).toMatch(/Only ADMIN accounts can grant/);
    }

    const [accountBefore] = await database.drizzle
      .select({ id: users.id })
      .from(users)
      .where(eq(users.employeeId, employeeId));
    expect(accountBefore).toBeUndefined();

    const manager = await provision('MANAGER', hrToken);
    expect(manager.errors).toBeUndefined();
    expect(manager.data.provisionStaffAccess.roles).toEqual(expect.arrayContaining(['MANAGER']));
    expect((await provision('SUPERVISOR', hrToken)).errors).toBeUndefined();

    const granted = await provision('ADMIN', adminToken);
    expect(granted.errors).toBeUndefined();
    expect(granted.data.provisionStaffAccess.roles).toEqual(expect.arrayContaining(['ADMIN']));
  });

  it('revokes the target sessions when a role is granted', async () => {
    const admin = await createUser('grantor', ['EMPLOYEE', 'ADMIN']);
    const adminToken = await tokenFor(admin.email);
    const employeeId = await createEmployee('revoke');
    const target = await createUser('revoke-target', ['EMPLOYEE'], employeeId);
    const targetToken = await tokenFor(target.email);

    const result = await gql(PROVISION, { input: { employeeId, roleKey: 'MANAGER' } }, adminToken);
    expect(result.errors).toBeUndefined();

    expect((await gql(ME, undefined, targetToken)).errors?.[0].message).toMatch(
      /Invalid or expired session|Unauthorized/,
    );
  });

  describe('revokeStaffAccess', () => {
    const SESSION_ERROR = /Invalid or expired session|Unauthorized/;

    async function staffTarget(label: string, roleKeys: SystemRoleKey[]) {
      const employeeId = await createEmployee(label);
      const user = await createUser(`rv-${label}`, ['EMPLOYEE', ...roleKeys], employeeId);
      return { employeeId, ...user };
    }

    it('removes the role and kills the target tokens immediately', async () => {
      const admin = await createUser('rv-admin', ['EMPLOYEE', 'ADMIN']);
      const adminToken = await tokenFor(admin.email);
      const target = await staffTarget('rvok', ['MANAGER']);
      const targetToken = await tokenFor(target.email);
      expect((await gql(ME, undefined, targetToken)).data.me.roles).toContain('MANAGER');

      const result = await gql(
        REVOKE,
        { input: { employeeId: target.employeeId, roleKey: 'manager' } },
        adminToken,
      );
      expect(result.errors).toBeUndefined();
      expect(result.data.revokeStaffAccess.id).toBe(target.id);
      expect(result.data.revokeStaffAccess.roles).toEqual(['EMPLOYEE']);

      expect((await gql(ME, undefined, targetToken)).errors?.[0].message).toMatch(SESSION_ERROR);
      const fresh = await tokenFor(target.email);
      expect((await gql(ME, undefined, fresh)).data.me.roles).toEqual(['EMPLOYEE']);
    });

    it('lets an ADMIN remove another ADMIN while other admins remain', async () => {
      const admin = await createUser('rv-admin2', ['EMPLOYEE', 'ADMIN']);
      const adminToken = await tokenFor(admin.email);
      const target = await staffTarget('rvadmin', ['ADMIN']);

      const result = await gql(
        REVOKE,
        { input: { employeeId: target.employeeId, roleKey: 'ADMIN' } },
        adminToken,
      );
      expect(result.errors).toBeUndefined();
      expect(result.data.revokeStaffAccess.roles).toEqual(['EMPLOYEE']);
    });

    it('forbids non-admin accounts, including HR_ADMIN', async () => {
      const hr = await createUser('rv-hr', ['EMPLOYEE', 'HR_ADMIN']);
      const employee = await createUser('rv-plain', ['EMPLOYEE']);
      const target = await staffTarget('rvforbid', ['MANAGER']);

      for (const email of [hr.email, employee.email]) {
        const denied = await gql(
          REVOKE,
          { input: { employeeId: target.employeeId, roleKey: 'MANAGER' } },
          await tokenFor(email),
        );
        expect(denied.errors?.[0].message).toBe('Only ADMIN accounts can revoke staff access');
      }

      const [still] = await database.drizzle
        .select({ id: userRoleAssignments.id })
        .from(userRoleAssignments)
        .innerJoin(roles, eq(roles.id, userRoleAssignments.roleId))
        .where(and(eq(userRoleAssignments.userId, target.id), eq(roles.key, 'MANAGER')));
      expect(still).toBeDefined();
    });

    it('blocks an admin from removing their own ADMIN role', async () => {
      const employeeId = await createEmployee('rvself');
      const self = await createUser('rv-self', ['EMPLOYEE', 'ADMIN'], employeeId);
      const token = await tokenFor(self.email);

      const result = await gql(REVOKE, { input: { employeeId, roleKey: 'ADMIN' } }, token);
      expect(result.errors?.[0].message).toBe(
        'You cannot remove your own ADMIN role. Ask another ADMIN to do it.',
      );
      expect((await gql(ME, undefined, token)).data.me.roles).toContain('ADMIN');
    });

    it('reports a role the account does not hold, and unknown accounts, as errors', async () => {
      const admin = await createUser('rv-admin3', ['EMPLOYEE', 'ADMIN']);
      const token = await tokenFor(admin.email);
      const target = await staffTarget('rvnone', []);

      const notHeld = await gql(REVOKE, { input: { employeeId: target.employeeId, roleKey: 'MANAGER' } }, token);
      expect(notHeld.errors?.[0].message).toBe('This account does not hold the MANAGER role');

      const badRole = await gql(REVOKE, { input: { employeeId: target.employeeId, roleKey: 'EMPLOYEE' } }, token);
      expect(badRole.errors?.[0].message).toMatch(/Staff access role must be/);

      const noAccount = await gql(REVOKE, { input: { employeeId: await createEmployee('rvnoacct'), roleKey: 'MANAGER' } }, token);
      expect(noAccount.errors?.[0].message).toBe('No account exists for this employee');
    });
  });

  it('rejects tokens that carry no session version', async () => {
    const user = await createUser('legacy', ['EMPLOYEE']);
    const legacy = app.get(JwtService, { strict: false }).sign({
      sub: user.id,
      email: user.email,
      roles: ['ADMIN'],
    });

    expect((await gql(ME, undefined, legacy)).errors?.[0].message).toMatch(
      /Invalid or expired session|Unauthorized/,
    );
  });

  it('throttles repeated failures per email and clears nothing for other emails', async () => {
    const user = await createUser('throttle', ['EMPLOYEE']);

    for (let i = 0; i < 5; i += 1) {
      expect((await login(user.email, 'WrongPass123!')).errors?.[0].message).toBe('Invalid credentials');
    }

    const blocked = await login(user.email);
    expect(blocked.errors?.[0].message).toMatch(/^Too many sign-in attempts\. Try again in \d+ minutes?\.$/);

    const other = await createUser('throttle-other', ['EMPLOYEE']);
    expect((await login(other.email)).errors).toBeUndefined();
  });

  it('reports a duplicate employee account as CONFLICT, not INTERNAL_SERVER_ERROR', async () => {
    const admin = await createUser('conflicter', ['EMPLOYEE', 'ADMIN']);
    const token = await tokenFor(admin.email);
    const employeeId = await createEmployee('Dup');
    // An account already holds this employee's email (not linked to the employee).
    await createUser('emp-Dup', ['EMPLOYEE']);

    const CREATE = `mutation($input: CreateEmployeeAccountInput!) { createEmployeeAccount(input: $input) { accessToken } }`;
    const created = await gql(CREATE, { input: { employeeId, password: 'DupPassword123!' } }, token);
    expect(created.errors?.[0].message).toBe('An account already exists for this employee email');
    expect(created.errors?.[0].extensions?.code).toBe('CONFLICT');

    const provisioned = await gql(
      PROVISION,
      { input: { employeeId, roleKey: 'MANAGER', password: 'DupPassword123!' } },
      token,
    );
    expect(provisioned.errors?.[0].message).toBe('An account already exists for this employee email');
    expect(provisioned.errors?.[0].extensions?.code).toBe('CONFLICT');

    // A second account for an employee that is already linked is also CONFLICT.
    const linkedEmployeeId = await createEmployee('Linked');
    const first = await gql(CREATE, { input: { employeeId: linkedEmployeeId, password: 'DupPassword123!' } }, token);
    expect(first.errors).toBeUndefined();
    const second = await gql(CREATE, { input: { employeeId: linkedEmployeeId, password: 'DupPassword123!' } }, token);
    expect(second.errors?.[0].message).toBe('This employee already has a linked account');
    expect(second.errors?.[0].extensions?.code).toBe('CONFLICT');
  });

  it('returns a readable validation message through GraphQL', async () => {
    const admin = await createUser('validator', ['EMPLOYEE', 'ADMIN']);
    const token = await tokenFor(admin.email);

    const result = await gql(
      `mutation($input: CreatePolicyDocumentInput!) { createPolicyDocument(input: $input) { id } }`,
      {
        input: {
          title: `Bad Url ${suffix}`,
          category: 'HR',
          version: '1',
          effectiveDate: '2026-01-01',
          description: 'x',
          documentUrl: 'javascript:alert(1)',
        },
      },
      token,
    );

    expect(result.errors?.[0].message).toBe('documentUrl: must be a valid http or https URL');
  });
});
