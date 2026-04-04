import { ForbiddenException } from '@nestjs/common';
import {
  ACCOUNT_MANAGER_ROLE_KEYS,
  ADMIN_ACCESS_ROLE_KEYS,
} from './system-roles';

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
