import { ConflictException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AppDrizzleDatabase } from '../database/database.service';
import { roles, userRoleAssignments, users } from '../database/drizzle/schema';

export const LAST_ADMIN_REVOKE_MESSAGE =
  'Cannot remove the last remaining ADMIN. Grant ADMIN to another account first.';
export const LAST_ADMIN_DEACTIVATE_MESSAGE =
  'Cannot deactivate the last active ADMIN. Grant ADMIN to another account first.';

/**
 * Locks every ADMIN assignment of an active account, and the matching user
 * rows, in a stable order (assignment id) so concurrent guards queue instead of
 * deadlocking. Under READ COMMITTED the filters are re-evaluated once the lock
 * is granted, so the returned rows reflect changes committed by whoever held
 * the lock before us. Must run inside a transaction.
 */
export async function lockActiveAdmins(tx: Pick<AppDrizzleDatabase, 'select'>) {
  return tx
    .select({ assignmentId: userRoleAssignments.id, userId: userRoleAssignments.userId })
    .from(userRoleAssignments)
    .innerJoin(roles, eq(roles.id, userRoleAssignments.roleId))
    .innerJoin(users, eq(users.id, userRoleAssignments.userId))
    .where(and(eq(roles.key, 'ADMIN'), eq(users.isActive, true)))
    .orderBy(userRoleAssignments.id)
    .for('update', { of: [userRoleAssignments, users] });
}

/**
 * Throws a CONFLICT when deactivating the accounts linked to an employee would
 * leave no active ADMIN. Does nothing when none of them is an active ADMIN.
 */
export async function assertNotLastActiveAdmin(
  tx: Pick<AppDrizzleDatabase, 'select'>,
  employeeId: string,
) {
  const [linkedAdmin] = await tx
    .select({ id: users.id })
    .from(users)
    .innerJoin(userRoleAssignments, eq(userRoleAssignments.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoleAssignments.roleId))
    .where(and(eq(users.employeeId, employeeId), eq(users.isActive, true), eq(roles.key, 'ADMIN')))
    .limit(1);

  if (!linkedAdmin) {
    return;
  }

  const locked = await lockActiveAdmins(tx);
  // Re-check under lock: if the account stopped being an active ADMIN while we
  // waited, there is nothing left to protect.
  const stillAdmin = locked.some((row) => row.userId === linkedAdmin.id);
  const remaining = locked.filter((row) => row.userId !== linkedAdmin.id);
  if (stillAdmin && remaining.length === 0) {
    throw new ConflictException(LAST_ADMIN_DEACTIVATE_MESSAGE);
  }
}
