export const SYSTEM_ROLE_KEYS = [
  'ADMIN',
  'HR_ADMIN',
  'MANAGER',
  'SUPERVISOR',
  'EMPLOYEE',
] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export const DEFAULT_ADMIN_ROLE: SystemRoleKey = 'ADMIN';

export const ADMIN_ACCESS_ROLE_KEYS = [
  'ADMIN',
  'HR_ADMIN',
  'MANAGER',
  'SUPERVISOR',
] as const;

export type AdminAccessRoleKey = (typeof ADMIN_ACCESS_ROLE_KEYS)[number];

export const ACCOUNT_MANAGER_ROLE_KEYS = ['ADMIN', 'HR_ADMIN'] as const;

export type AccountManagerRoleKey = (typeof ACCOUNT_MANAGER_ROLE_KEYS)[number];

export const SYSTEM_ROLE_DETAILS: Record<
  SystemRoleKey,
  { name: string; description: string }
> = {
  ADMIN: {
    name: 'Administrator',
    description: 'Platform administrator with full access',
  },
  HR_ADMIN: {
    name: 'HR Administrator',
    description: 'Human resources administrator with employee and policy control',
  },
  MANAGER: {
    name: 'Manager',
    description: 'Manager with team administration access',
  },
  SUPERVISOR: {
    name: 'Supervisor',
    description: 'Supervisor with operational administration access',
  },
  EMPLOYEE: {
    name: 'Employee',
    description: 'Employee self-service account',
  },
};
