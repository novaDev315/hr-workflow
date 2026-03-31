export const ADMIN_PANEL_ROLES = [
  'ADMIN',
  'HR_ADMIN',
  'MANAGER',
  'SUPERVISOR',
] as const

export const ACCOUNT_MANAGER_ROLES = ['ADMIN', 'HR_ADMIN'] as const

export type AdminPanelRole = (typeof ADMIN_PANEL_ROLES)[number]
export type AccountManagerRole = (typeof ACCOUNT_MANAGER_ROLES)[number]

export type StoredAdminAccount = {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  roles: string[]
  isActive: boolean
}

const ADMIN_ACCOUNT_STORAGE_KEY = 'admin_account'
const LEGACY_ADMIN_USER_STORAGE_KEY = 'user'

export function hasAdminPanelAccess(roles: string[] = []) {
  return roles.some((role) =>
    ADMIN_PANEL_ROLES.includes(role as AdminPanelRole)
  )
}

export function canManageAccounts(roles: string[] = []) {
  return roles.some((role) =>
    ACCOUNT_MANAGER_ROLES.includes(role as AccountManagerRole)
  )
}

export function readStoredAdminAccount() {
  const rawAccount =
    localStorage.getItem(ADMIN_ACCOUNT_STORAGE_KEY) ??
    localStorage.getItem(LEGACY_ADMIN_USER_STORAGE_KEY)

  if (!rawAccount) {
    return null
  }

  try {
    return JSON.parse(rawAccount) as StoredAdminAccount
  } catch {
    return null
  }
}

export function persistAdminSession(payload: {
  accessToken: string
  account: StoredAdminAccount
}) {
  localStorage.setItem('auth_token', payload.accessToken)
  localStorage.setItem(ADMIN_ACCOUNT_STORAGE_KEY, JSON.stringify(payload.account))
}

export function clearAdminSession() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem(ADMIN_ACCOUNT_STORAGE_KEY)
  localStorage.removeItem(LEGACY_ADMIN_USER_STORAGE_KEY)
}
