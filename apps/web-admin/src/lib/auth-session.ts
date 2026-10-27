import { useSyncExternalStore } from 'react'

export type StoredAdminAccount = {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  roles: string[]
  canAccessAdminPanel?: boolean
  canManageAccounts?: boolean
  isActive: boolean
}

const ADMIN_ACCOUNT_STORAGE_KEY = 'admin_account'
const LEGACY_ADMIN_USER_STORAGE_KEY = 'user'
const AUTH_TOKEN_STORAGE_KEY = 'auth_token'
const SESSION_CHANGE_EVENT = 'hrflow-admin-session-change'

type AdminSessionSnapshot = {
  token: string | null
  account: StoredAdminAccount | null
  hasAccess: boolean
  isAuthenticated: boolean
}

const EMPTY_ADMIN_SESSION: AdminSessionSnapshot = {
  token: null,
  account: null,
  hasAccess: false,
  isAuthenticated: false,
}

let cachedToken: string | null = null
let cachedAccountRaw: string | null = null
let cachedSnapshot: AdminSessionSnapshot = EMPTY_ADMIN_SESSION

// Storage can be unavailable (private mode, blocked site data). Every access
// goes through these helpers so a storage failure never breaks the app.
function storageGet(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function storageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore: session simply won't persist across reloads
  }
}

function storageRemove(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

// Server/cache teardown registered by the Apollo client module. Kept as a
// registration hook so this module does not import the client (no cycle).
type SessionTeardown = (token: string | null, reason: 'logout' | 'expired') => Promise<unknown> | void
let sessionTeardown: SessionTeardown | null = null

export function registerSessionTeardown(teardown: SessionTeardown) {
  sessionTeardown = teardown
}

export function hasAdminPanelAccess(account: StoredAdminAccount | null | undefined) {
  return Boolean(account?.canAccessAdminPanel)
}

export function canManageAccounts(account: StoredAdminAccount | null | undefined) {
  return Boolean(account?.canManageAccounts)
}

function readRawAccount() {
  return storageGet(ADMIN_ACCOUNT_STORAGE_KEY) ?? storageGet(LEGACY_ADMIN_USER_STORAGE_KEY)
}

export function readStoredAdminAccount() {
  const rawAccount = readRawAccount()

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
  return storageGet(AUTH_TOKEN_STORAGE_KEY)
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
  storageSet(AUTH_TOKEN_STORAGE_KEY, payload.accessToken)
  storageSet(ADMIN_ACCOUNT_STORAGE_KEY, JSON.stringify(payload.account))
  emitSessionChange()
}

function removeStoredSession() {
  storageRemove(AUTH_TOKEN_STORAGE_KEY)
  storageRemove(ADMIN_ACCOUNT_STORAGE_KEY)
  storageRemove(LEGACY_ADMIN_USER_STORAGE_KEY)
}

/**
 * Ends the admin session: tells the server to revoke it (best effort, never
 * blocks), clears the Apollo cache, and removes the stored token/account.
 * Pass `{ serverLogout: false }` when the server already rejected the token.
 *
 * The change is announced only after the cache is cleared. Clearing cancels
 * every query in flight, so announcing first would let the sign-in page mount
 * and have its first query cancelled.
 */
export function clearAdminSession(options: { serverLogout?: boolean } = {}): Promise<void> {
  const token = readAuthToken()
  removeStoredSession()

  let teardown: Promise<unknown> | void = undefined
  try {
    teardown = sessionTeardown?.(
      options.serverLogout === false ? null : token,
      options.serverLogout === false ? 'expired' : 'logout',
    )
  } catch {
    // teardown is best effort
  }

  return Promise.resolve(teardown)
    .catch(() => undefined)
    .then(emitSessionChange)
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
  if (typeof window === 'undefined') {
    return EMPTY_ADMIN_SESSION
  }

  const token = storageGet(AUTH_TOKEN_STORAGE_KEY)
  const accountRaw = readRawAccount()

  if (token === cachedToken && accountRaw === cachedAccountRaw) {
    return cachedSnapshot
  }

  let account: StoredAdminAccount | null = null

  if (accountRaw) {
    try {
      account = JSON.parse(accountRaw) as StoredAdminAccount
    } catch {
      account = null
    }
  }

  const hasAccess = hasAdminPanelAccess(account)
  cachedToken = token
  cachedAccountRaw = accountRaw
  cachedSnapshot = {
    token,
    account,
    hasAccess,
    isAuthenticated: Boolean(token && account),
  }

  return cachedSnapshot
}

export function useAdminSession() {
  return useSyncExternalStore(
    subscribeToAdminSession,
    getAdminSessionSnapshot,
    () => EMPTY_ADMIN_SESSION
  )
}
