import { randomUUID } from 'crypto';
import { count, eq, sql } from 'drizzle-orm';
import type { AppDrizzleDatabase } from '../database/database.service';
import { roles, userRoleAssignments, users } from '../database/drizzle/schema';
import {
  DEFAULT_ADMIN_ROLE,
  SYSTEM_ROLE_DETAILS,
  SystemRoleKey,
} from '../common/system-roles';

/** Looks up a system role by key, creating it if it does not exist yet. */
export async function ensureSystemRole(key: SystemRoleKey, db: any) {
  const [existingRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.key, key))
    .limit(1);

  if (existingRole) {
    return existingRole as { id: string };
  }

  const details = SYSTEM_ROLE_DETAILS[key];

  const [createdRole] = await db
    .insert(roles)
    .values({
      id: randomUUID(),
      key,
      name: details.name,
      description: details.description,
    })
    .returning({ id: roles.id });

  return createdRole as { id: string };
}

export interface FirstAdminInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
}

/**
 * Creates the first ADMIN account. A transaction-scoped advisory lock
 * serializes concurrent callers (HTTP bootstrap, several instances seeding on
 * boot) so the zero-user check cannot race. Returns the new user id, or null
 * when any user already exists.
 */
export async function createFirstAdminAccount(
  database: AppDrizzleDatabase,
  input: FirstAdminInput,
): Promise<string | null> {
  return database.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('rakss:first-admin-bootstrap'))`,
    );

    const [countRow] = await tx.select({ count: count() }).from(users);
    if (Number(countRow?.count ?? 0) > 0) {
      return null;
    }

    const adminRole = await ensureSystemRole(DEFAULT_ADMIN_ROLE, tx);

    const [user] = await tx
      .insert(users)
      .values({
        id: randomUUID(),
        email: input.email,
        employeeId: null,
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
      })
      .returning({ id: users.id });

    await tx.insert(userRoleAssignments).values({
      id: randomUUID(),
      userId: user.id,
      roleId: adminRole.id,
    });

    return user.id;
  });
}
