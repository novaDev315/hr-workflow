import { useSyncExternalStore } from 'react'

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
const AUTH_TOKEN_STORAGE_KEY = 'auth_token'
const SESSION_CHANGE_EVENT = 'hrflow-admin-session-change'

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

export function readAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
}

function emitSessionChange() {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT))
}

export function persistAdminSession(payload: {
  accessToken: string
  account: StoredAdminAccount
}) {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, payload.accessToken)
  localStorage.setItem(ADMIN_ACCOUNT_STORAGE_KEY, JSON.stringify(payload.account))
  emitSessionChange()
}

export function clearAdminSession() {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
  localStorage.removeItem(ADMIN_ACCOUNT_STORAGE_KEY)
  localStorage.removeItem(LEGACY_ADMIN_USER_STORAGE_KEY)
  emitSessionChange()
}

function subscribeToAdminSession(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const handleChange = () => onStoreChange()

  window.addEventListener('storage', handleChange)
  window.addEventListener(SESSION_CHANGE_EVENT, handleChange)

  return () => {
    window.removeEventListener('storage', handleChange)
    window.removeEventListener(SESSION_CHANGE_EVENT, handleChange)
  }
}

function getAdminSessionSnapshot() {
  const token = readAuthToken()
  const account = readStoredAdminAccount()
  const hasAccess = account ? hasAdminPanelAccess(account.roles) : false

  return {
    token,
    account,
    hasAccess,
    isAuthenticated: Boolean(token && account),
  }
}

export function useAdminSession() {
  return useSyncExternalStore(
    subscribeToAdminSession,
    getAdminSessionSnapshot,
    () => ({
      token: null,
      account: null,
      hasAccess: false,
      isAuthenticated: false,
    })
  )
}
