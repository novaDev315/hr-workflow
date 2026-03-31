export const ADMIN_PANEL_ROLES = [
  'ADMIN',
  'HR_ADMIN',
  'MANAGER',
  'SUPERVISOR',
] as const

export type AdminPanelRole = (typeof ADMIN_PANEL_ROLES)[number]

export type StoredAdminUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  roles: string[]
  isActive: boolean
}

export function hasAdminPanelAccess(roles: string[] = []) {
  return roles.some((role) =>
    ADMIN_PANEL_ROLES.includes(role as AdminPanelRole)
  )
}

export function readStoredAdminUser() {
  const rawUser = localStorage.getItem('user')
  if (!rawUser) {
    return null
  }

  try {
    return JSON.parse(rawUser) as StoredAdminUser
  } catch {
    return null
  }
}

export function clearAdminSession() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('user')
}
