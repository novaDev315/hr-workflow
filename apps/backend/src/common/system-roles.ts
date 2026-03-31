export const SYSTEM_ROLE_KEYS = [
  'ADMIN',
  'HR_ADMIN',
  'MANAGER',
  'SUPERVISOR',
  'EMPLOYEE',
] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export const DEFAULT_ADMIN_ROLE: SystemRoleKey = 'ADMIN';
