import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import { count, eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import { seedEnvAdmin } from '../database/seeds';
import {
  leaveTypes,
  policyDocuments,
  roles,
  userRoleAssignments,
  users,
} from '../database/drizzle/schema';

jest.setTimeout(60000);

/**
 * Bootstrap logic depends on the users table being empty, which other specs
 * sharing the database cannot guarantee. This suite therefore runs against a
 * private schema holding copies of only the tables it touches.
 */
describe('First-admin bootstrap and env admin seeding', () => {
  const schemaName = `auth_bootstrap_${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const baseUrl = process.env.DATABASE_URL!;
  const saved: Record<string, string | undefined> = {};
  let moduleFixture: TestingModule;
  let database: DatabaseService;
  let auth: AuthService;

  const setEnv = (values: Record<string, string | undefined>) => {
    for (const [key, value] of Object.entries(values)) {
      if (!(key in saved)) {
        saved[key] = process.env[key];
      }
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };

  const resetAccounts = async () => {
    await database.drizzle.delete(userRoleAssignments);
    await database.drizzle.delete(users);
  };

  const accountSummary = async () => {
    const rows = await database.drizzle
      .select({ email: users.email, passwordHash: users.passwordHash, role: roles.key })
      .from(users)
      .innerJoin(userRoleAssignments, eq(userRoleAssignments.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoleAssignments.roleId));
    const [{ total }] = await database.drizzle.select({ total: count() }).from(users);
    return { rows, total: Number(total) };
  };

  const bootstrapInput = {
    email: 'First.Admin@Example.test',
    password: 'FirstAdminPass1!',
    firstName: 'First',
    lastName: 'Admin',
  };

  beforeAll(async () => {
    const admin = new Pool({ connectionString: baseUrl });
    await admin.query(`CREATE SCHEMA "${schemaName}"`);
    for (const table of ['users', 'roles', 'user_role_assignments', 'leave_types', 'policy_documents']) {
      await admin.query(
        `CREATE TABLE "${schemaName}"."${table}" (LIKE public."${table}" INCLUDING ALL)`,
      );
    }
    await admin.end();

    const url = new URL(baseUrl);
    url.searchParams.set('options', `-c search_path=${schemaName}`);
    setEnv({
      DATABASE_URL: url.toString(),
      JWT_SECRET: 'bootstrap-test-secret-0123456789abcdef-0123',
      RAKSS_ADMIN_EMAIL: undefined,
      RAKSS_ADMIN_PASSWORD: undefined,
      BOOTSTRAP_ALLOWED: undefined,
      NODE_ENV: 'test',
    });

    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        DatabaseModule,
        AuthModule,
      ],
    }).compile();
    await moduleFixture.init();

    database = moduleFixture.get(DatabaseService);
    auth = moduleFixture.get(AuthService);
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

  it('reports bootstrap as required only for an empty, bootstrap-enabled system', async () => {
    expect(await auth.getBootstrapStatus()).toEqual({ bootstrapRequired: true, accountCount: 0 });

    setEnv({ NODE_ENV: 'production' });
    expect(await auth.getBootstrapStatus()).toEqual({ bootstrapRequired: false, accountCount: 0 });

    setEnv({ BOOTSTRAP_ALLOWED: 'true' });
    expect(await auth.getBootstrapStatus()).toEqual({ bootstrapRequired: true, accountCount: 0 });

    setEnv({ NODE_ENV: 'test', BOOTSTRAP_ALLOWED: undefined });
  });

  it('refuses bootstrap in production unless BOOTSTRAP_ALLOWED=true', async () => {
    setEnv({ NODE_ENV: 'production' });
    await expect(auth.bootstrapAdmin(bootstrapInput)).rejects.toThrow('Bootstrap is disabled');
    expect((await accountSummary()).total).toBe(0);

    setEnv({ BOOTSTRAP_ALLOWED: 'true' });
    const session = await auth.bootstrapAdmin(bootstrapInput);
    expect(session.account.roles).toEqual(['ADMIN']);

    setEnv({ NODE_ENV: 'test', BOOTSTRAP_ALLOWED: undefined });
  });

  it('creates exactly one admin when bootstraps race', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, index) =>
        auth.bootstrapAdmin({ ...bootstrapInput, email: `racer${index}@example.test` }),
      ),
    );

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    for (const result of results.filter((entry) => entry.status === 'rejected')) {
      expect((result as PromiseRejectedResult).reason.message).toBe(
        'Bootstrap is only allowed before the first user exists',
      );
    }
    expect((await accountSummary()).total).toBe(1);
  });

  it('refuses bootstrap once any user exists', async () => {
    await auth.bootstrapAdmin(bootstrapInput);

    await expect(
      auth.bootstrapAdmin({ ...bootstrapInput, email: 'second@example.test' }),
    ).rejects.toThrow('Bootstrap is only allowed before the first user exists');
    expect(await auth.getBootstrapStatus()).toEqual({ bootstrapRequired: false, accountCount: 1 });
  });

  it('seeds exactly one ADMIN from the environment, even when run concurrently', async () => {
    const env = {
      RAKSS_ADMIN_EMAIL: ' Env.Admin@Example.test ',
      RAKSS_ADMIN_PASSWORD: 'EnvAdminPass123!',
    };

    await Promise.all([
      seedEnvAdmin(database.drizzle, env),
      seedEnvAdmin(database.drizzle, env),
      seedEnvAdmin(database.drizzle, env),
    ]);

    setEnv(env);
    await database.ensureSeedData();
    setEnv({ RAKSS_ADMIN_EMAIL: undefined, RAKSS_ADMIN_PASSWORD: undefined });

    const { rows, total } = await accountSummary();
    expect(total).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('env.admin@example.test');
    expect(rows[0].role).toBe('ADMIN');
    expect(await bcrypt.compare('EnvAdminPass123!', rows[0].passwordHash)).toBe(true);

    const session = await auth.login({ email: 'env.admin@example.test', password: 'EnvAdminPass123!' });
    expect(session.account.roles).toEqual(['ADMIN']);
  });

  it('does not seed from the environment when a user exists or the variables are incomplete', async () => {
    await seedEnvAdmin(database.drizzle, { RAKSS_ADMIN_EMAIL: 'only@example.test' });
    expect((await accountSummary()).total).toBe(0);

    await auth.bootstrapAdmin(bootstrapInput);
    await seedEnvAdmin(database.drizzle, {
      RAKSS_ADMIN_EMAIL: 'env.admin@example.test',
      RAKSS_ADMIN_PASSWORD: 'EnvAdminPass123!',
    });
    const { rows, total } = await accountSummary();
    expect(total).toBe(1);
    expect(rows[0].email).toBe('first.admin@example.test');
  });

  it('survives renamed seeded rows on the next boot instead of crash-looping', async () => {
    await database.drizzle
      .update(leaveTypes)
      .set({ code: 'RENAMED_CASUAL' })
      .where(eq(leaveTypes.id, 'seed-leave-casual'));
    await database.drizzle
      .update(policyDocuments)
      .set({ title: 'Renamed Handbook' })
      .where(eq(policyDocuments.id, 'seed-policy-handbook'));

    await expect(database.ensureSeedData()).resolves.toBeUndefined();

    const [renamed] = await database.drizzle
      .select({ code: leaveTypes.code })
      .from(leaveTypes)
      .where(eq(leaveTypes.id, 'seed-leave-casual'));
    expect(renamed.code).toBe('RENAMED_CASUAL');
  });
});
