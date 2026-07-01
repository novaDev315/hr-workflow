import { ForbiddenException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { AuthenticatedUser } from './current-user.decorator';
import { DatabaseService } from '../database/database.service';
import { employees, users } from '../database/drizzle/schema';
import {
  ACCOUNT_MANAGER_ROLE_KEYS,
  ADMIN_ACCESS_ROLE_KEYS,
} from './system-roles';

export type EmployeeVisibilityScope =
  | { kind: 'all'; label: string }
  | { kind: 'department'; label: string; departmentId: string; employeeId: string }
  | { kind: 'supervisor'; label: string; employeeId: string }
  | { kind: 'self'; label: string; employeeId: string };

interface LinkedEmployeeContext {
  employeeId: string | null;
  departmentId: string | null;
}

export function hasAdminPanelAccess(roles: string[] = []) {
  return roles.some((role) =>
    ADMIN_ACCESS_ROLE_KEYS.includes(
      role as (typeof ADMIN_ACCESS_ROLE_KEYS)[number],
    ),
  );
}

export function hasAccountManagerAccess(roles: string[] = []) {
  return roles.some((role) =>
    ACCOUNT_MANAGER_ROLE_KEYS.includes(
      role as (typeof ACCOUNT_MANAGER_ROLE_KEYS)[number],
    ),
  );
}

export function hasGlobalAdminAccess(roles: string[] = []) {
  return roles.some((role) => role === 'ADMIN' || role === 'HR_ADMIN');
}

export function hasManagerAccess(roles: string[] = []) {
  return roles.includes('MANAGER');
}

export function hasSupervisorAccess(roles: string[] = []) {
  return roles.includes('SUPERVISOR');
}

export function assertAdminPanelAccess(roles: string[] = []) {
  if (!hasAdminPanelAccess(roles)) {
    throw new ForbiddenException(
      'Only staff and admin accounts can access this module',
    );
  }
}

export function assertAccountManagerAccess(roles: string[] = []) {
  if (!hasAccountManagerAccess(roles)) {
    throw new ForbiddenException(
      'Only ADMIN and HR_ADMIN accounts can perform this action',
    );
  }
}

export async function resolveEmployeeVisibilityScope(
  database: DatabaseService,
  currentUser: AuthenticatedUser,
): Promise<EmployeeVisibilityScope> {
  if (hasGlobalAdminAccess(currentUser.roles)) {
    return {
      kind: 'all',
      label: 'All employees',
    };
  }

  const linkedEmployee = await getLinkedEmployeeContext(database, currentUser.userId);

  if (hasManagerAccess(currentUser.roles)) {
    if (!linkedEmployee.departmentId || !linkedEmployee.employeeId) {
      throw new ForbiddenException(
        'Manager accounts must be linked to an active employee profile with a department',
      );
    }

    return {
      kind: 'department',
      label: 'Department employees',
      departmentId: linkedEmployee.departmentId,
      employeeId: linkedEmployee.employeeId,
    };
  }

  if (hasSupervisorAccess(currentUser.roles)) {
    if (!linkedEmployee.employeeId) {
      throw new ForbiddenException(
        'Supervisor accounts must be linked to an active employee profile',
      );
    }

    return {
      kind: 'supervisor',
      label: 'Direct reports',
      employeeId: linkedEmployee.employeeId,
    };
  }

  if (!linkedEmployee.employeeId) {
    throw new ForbiddenException(
      'This account can sign in, but it is not linked to an employee profile',
    );
  }

  return {
    kind: 'self',
    label: 'Own employee profile',
    employeeId: linkedEmployee.employeeId,
  };
}

export function buildEmployeeVisibilityClause(
  values: unknown[],
  scope: EmployeeVisibilityScope,
  columns: {
    employeeId: string;
    departmentId: string;
    supervisorId: string;
  },
) {
  switch (scope.kind) {
    case 'all':
      return '';
    case 'department':
      values.push(scope.departmentId);
      return `${columns.departmentId} = $${values.length}`;
    case 'supervisor':
      values.push(scope.employeeId);
      return `(${columns.employeeId} = $${values.length} OR ${columns.supervisorId} = $${values.length})`;
    case 'self':
      values.push(scope.employeeId);
      return `${columns.employeeId} = $${values.length}`;
  }
}

export function canAccessEmployeeWithinScope(
  scope: EmployeeVisibilityScope,
  target: {
    employeeId: string;
    departmentId?: string | null;
    supervisorId?: string | null;
  },
) {
  switch (scope.kind) {
    case 'all':
      return true;
    case 'department':
      return target.departmentId === scope.departmentId;
    case 'supervisor':
      return (
        target.employeeId === scope.employeeId ||
        target.supervisorId === scope.employeeId
      );
    case 'self':
      return target.employeeId === scope.employeeId;
  }
}

async function getLinkedEmployeeContext(
  database: DatabaseService,
  userId: string,
): Promise<LinkedEmployeeContext> {
  const [row] = await database.drizzle
    .select({
      employeeId: users.employeeId,
      departmentId: employees.departmentId,
    })
    .from(users)
    .leftJoin(employees, eq(employees.id, users.employeeId))
    .where(eq(users.id, userId))
    .limit(1);

  return {
    employeeId: row?.employeeId ?? null,
    departmentId: row?.departmentId ?? null,
  };
}
