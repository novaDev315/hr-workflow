import { ConflictException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import { ensureSystemRole } from '../auth/bootstrap-admin';
import { AuthenticatedUser } from '../common/current-user.decorator';
import { SystemRoleKey } from '../common/system-roles';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import {
  departments,
  designations,
  employees,
  userRoleAssignments,
  users,
} from '../database/drizzle/schema';
import { EmployeeService } from '../employee/employee.service';

jest.setTimeout(60000);

const REVOKE_LAST = 'Cannot remove the last remaining ADMIN. Grant ADMIN to another account first.';
const DEACTIVATE_LAST = 'Cannot deactivate the last active ADMIN. Grant ADMIN to another account first.';

/**
 * The last-ADMIN invariant depends on the complete set of ADMIN accounts, which
 * suites sharing the database cannot control. This suite runs against a private
 * schema holding copies of only the tables it touches, so it never changes
 * accounts that other suites (or real data) rely on.
 */
describe('Last active ADMIN invariant', () => {
  const schemaName = `admin_guard_${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const baseUrl = process.env.DATABASE_URL!;
  const saved: Record<string, string | undefined> = {};
  const departmentId = randomUUID();
  const designationId = randomUUID();
  let moduleFixture: TestingModule;
  let database: DatabaseService;
  let auth: AuthService;
  let employeeService: EmployeeService;
  let counter = 0;

  const asActor = (user: { id: string; email: string }, roles: string[] = ['ADMIN']): AuthenticatedUser => ({
    userId: user.id,
    email: user.email,
    roles,
  });

  async function createAccount(label: string, roleKeys: SystemRoleKey[], opts: { active?: boolean } = {}) {
    counter += 1;
    const employeeId = randomUUID();
    const email = `${label}.${counter}@example.test`;
    await database.drizzle.insert(employees).values({
      id: employeeId,
      employeeNumber: `G${counter}`,
      firstName: label,
      lastName: 'Guard',
      email,
      departmentId,
      designationId,
      joinDate: '2026-01-01',
    });
    const id = randomUUID();
    await database.drizzle.insert(users).values({
      id,
      email,
      employeeId,
      passwordHash: 'not-a-real-hash',
      firstName: label,
      lastName: 'Guard',
      isActive: opts.active ?? true,
    });
    for (const key of roleKeys) {
      const role = await ensureSystemRole(key, database.drizzle);
      await database.drizzle
        .insert(userRoleAssignments)
        .values({ id: randomUUID(), userId: id, roleId: role.id });
    }
    return { id, email, employeeId };
  }

  const resetAccounts = async () => {
    await database.drizzle.delete(userRoleAssignments);
    await database.drizzle.delete(users);
    await database.drizzle.delete(employees);
  };

  const isActive = async (userId: string) => {
    const [row] = await database.drizzle
      .select({ isActive: users.isActive })
      .from(users)
      .where(eq(users.id, userId));
    return row.isActive;
  };

  const rolesOf = async (userId: string) => {
    const rows = await database.drizzle
      .select({ roleId: userRoleAssignments.roleId })
      .from(userRoleAssignments)
      .where(eq(userRoleAssignments.userId, userId));
    return rows.length;
  };

  const outcome = async (promise: Promise<unknown>) =>
    promise.then(
      () => ({ ok: true as const }),
      (error: unknown) => ({ ok: false as const, error }),
    );

  beforeAll(async () => {
    const admin = new Pool({ connectionString: baseUrl });
    await admin.query(`CREATE SCHEMA "${schemaName}"`);
    for (const table of [
      'users',
      'roles',
      'user_role_assignments',
      'employees',
      'departments',
      'designations',
      'leave_types',
      'policy_documents',
    ]) {
      await admin.query(
        `CREATE TABLE "${schemaName}"."${table}" (LIKE public."${table}" INCLUDING ALL)`,
      );
    }
    await admin.end();

    const url = new URL(baseUrl);
    url.searchParams.set('options', `-c search_path=${schemaName}`);
    for (const [key, value] of Object.entries({
      DATABASE_URL: url.toString(),
      JWT_SECRET: 'admin-guard-test-secret-0123456789abcdef-0123',
      NODE_ENV: 'test',
    })) {
      saved[key] = process.env[key];
      process.env[key] = value;
    }

    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        DatabaseModule,
        AuthModule,
      ],
      providers: [EmployeeService],
    }).compile();
    await moduleFixture.init();

    database = moduleFixture.get(DatabaseService);
    auth = moduleFixture.get(AuthService);
    employeeService = moduleFixture.get(EmployeeService);

    await database.drizzle.insert(departments).values({
      id: departmentId,
      name: 'Guard Dept',
      code: 'GUARD',
    });
    await database.drizzle.insert(designations).values({
      id: designationId,
      title: 'Guard Designation',
      code: 'GUARDD',
      departmentId,
    });
  });

  afterAll(async () => {
    await moduleFixture?.close();

    const admin = new Pool({ connectionString: baseUrl });
    await admin.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await admin.end();

    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  beforeEach(resetAccounts);

  describe('revokeStaffAccess', () => {
    it('removes ADMIN from another admin while the acting admin stays', async () => {
      const a = await createAccount('a', ['EMPLOYEE', 'ADMIN']);
      const b = await createAccount('b', ['EMPLOYEE', 'ADMIN']);

      const result = await auth.revokeStaffAccess(asActor(a), {
        employeeId: b.employeeId,
        roleKey: 'ADMIN',
      });
      expect(result.roles).toEqual(['EMPLOYEE']);
    });

    it('refuses when the acting account is no longer an active ADMIN (target is the last one)', async () => {
      const stale = await createAccount('stale', ['EMPLOYEE', 'ADMIN'], { active: false });
      const last = await createAccount('last', ['EMPLOYEE', 'ADMIN']);

      await expect(
        auth.revokeStaffAccess(asActor(stale), { employeeId: last.employeeId, roleKey: 'ADMIN' }),
      ).rejects.toThrow(REVOKE_LAST);
      expect(await rolesOf(last.id)).toBe(2);
    });

    it('lets exactly one of two admins remove the other when fired together', async () => {
      const a = await createAccount('a', ['EMPLOYEE', 'ADMIN']);
      const b = await createAccount('b', ['EMPLOYEE', 'ADMIN']);

      const results = await Promise.all([
        outcome(auth.revokeStaffAccess(asActor(a), { employeeId: b.employeeId, roleKey: 'ADMIN' })),
        outcome(auth.revokeStaffAccess(asActor(b), { employeeId: a.employeeId, roleKey: 'ADMIN' })),
      ]);

      const succeeded = results.filter((r) => r.ok);
      const failed = results.filter((r) => !r.ok) as Array<{ ok: false; error: unknown }>;
      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect(failed[0].error).toBeInstanceOf(ConflictException);
      expect((failed[0].error as Error).message).toBe(REVOKE_LAST);

      // Exactly one ADMIN assignment is left among the two accounts.
      expect((await rolesOf(a.id)) + (await rolesOf(b.id))).toBe(3);
    });
  });

  describe('employee deactivation', () => {
    it('refuses deactivate() for the only active ADMIN, even from HR_ADMIN', async () => {
      const only = await createAccount('only', ['EMPLOYEE', 'ADMIN']);
      const hr = asActor({ id: randomUUID(), email: 'hr@example.test' }, ['HR_ADMIN']);

      await expect(employeeService.deactivate(hr, { id: only.employeeId })).rejects.toThrow(
        DEACTIVATE_LAST,
      );
      await expect(
        employeeService.deactivate(asActor(only), { id: only.employeeId }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(await isActive(only.id)).toBe(true);
      const [employee] = await database.drizzle
        .select({ isActive: employees.isActive, status: employees.status })
        .from(employees)
        .where(eq(employees.id, only.employeeId));
      expect(employee.isActive).toBe(true);
      expect(employee.status).not.toBe('INACTIVE');
    });

    it('refuses update() to INACTIVE for the only active ADMIN', async () => {
      const only = await createAccount('only', ['EMPLOYEE', 'ADMIN']);

      await expect(
        employeeService.update(asActor(only), { id: only.employeeId, status: 'INACTIVE' }),
      ).rejects.toThrow(DEACTIVATE_LAST);
      expect(await isActive(only.id)).toBe(true);
    });

    it('allows deactivation while another active ADMIN remains, and of non-admins', async () => {
      const a = await createAccount('a', ['EMPLOYEE', 'ADMIN']);
      const b = await createAccount('b', ['EMPLOYEE', 'ADMIN']);
      const plain = await createAccount('plain', ['EMPLOYEE']);

      await employeeService.deactivate(asActor(a), { id: b.employeeId });
      expect(await isActive(b.id)).toBe(false);
      await employeeService.deactivate(asActor(a), { id: plain.employeeId });
      expect(await isActive(plain.id)).toBe(false);

      // a is now the only active ADMIN and is protected.
      await expect(employeeService.deactivate(asActor(a), { id: a.employeeId })).rejects.toThrow(
        DEACTIVATE_LAST,
      );
    });

    it('does not count an already inactive ADMIN as a remaining administrator', async () => {
      const inactive = await createAccount('inactive', ['EMPLOYEE', 'ADMIN'], { active: false });
      const only = await createAccount('only', ['EMPLOYEE', 'ADMIN']);
      expect(inactive.id).toBeDefined();

      await expect(
        employeeService.deactivate(asActor(only), { id: only.employeeId }),
      ).rejects.toThrow(DEACTIVATE_LAST);
    });

    it('lets exactly one of two admins deactivate the other when fired together', async () => {
      const a = await createAccount('a', ['EMPLOYEE', 'ADMIN']);
      const b = await createAccount('b', ['EMPLOYEE', 'ADMIN']);

      const results = await Promise.all([
        outcome(employeeService.deactivate(asActor(a), { id: b.employeeId })),
        outcome(employeeService.deactivate(asActor(b), { id: a.employeeId })),
      ]);

      const failed = results.filter((r) => !r.ok) as Array<{ ok: false; error: unknown }>;
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect(failed[0].error).toBeInstanceOf(ConflictException);
      expect((failed[0].error as Error).message).toBe(DEACTIVATE_LAST);
      expect([await isActive(a.id), await isActive(b.id)].filter(Boolean)).toHaveLength(1);
    });
  });
});
