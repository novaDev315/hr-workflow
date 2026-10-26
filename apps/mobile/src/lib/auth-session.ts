import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { create } from 'zustand'

// SecureStore keys allow only [A-Za-z0-9._-].
const SECURE_TOKEN_KEY = 'hrflow.auth_token'
const LEGACY_TOKEN_KEY = 'auth_token'
const AUTH_ACCOUNT_KEY = 'account'
const LEGACY_AUTH_USER_KEY = 'user'

export interface AccountProfile {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  isActive: boolean
  roles: string[]
  employeeId?: string | null
  employeeNumber?: string | null
  departmentName?: string | null
  designationTitle?: string | null
  employeeStatus?: string | null
}

/**
 * Token storage: the Keychain/Keystore via expo-secure-store on iOS and
 * Android. The web preview has no secure store, so it falls back to
 * AsyncStorage (localStorage) there.
 */
const tokenStore = {
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') return AsyncStorage.getItem(LEGACY_TOKEN_KEY)
    return SecureStore.getItemAsync(SECURE_TOKEN_KEY)
  },
  async set(token: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(LEGACY_TOKEN_KEY, token)
      return
    }
    await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token)
  },
  async clear(): Promise<void> {
    if (Platform.OS !== 'web') {
      await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY).catch(() => undefined)
    }
    await AsyncStorage.removeItem(LEGACY_TOKEN_KEY).catch(() => undefined)
  },
}

/** One-time move of a token that older builds kept in plain AsyncStorage. */
async function migrateLegacyToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null
  const legacy = await AsyncStorage.getItem(LEGACY_TOKEN_KEY)
  if (!legacy) return null
  await SecureStore.setItemAsync(SECURE_TOKEN_KEY, legacy)
  await AsyncStorage.removeItem(LEGACY_TOKEN_KEY)
  return legacy
}

interface AuthSessionState {
  isHydrated: boolean
  token: string | null
  account: AccountProfile | null
  /** Calm message shown on the sign-in screen after a forced sign-out. */
  notice: string | null
  hydrate: () => Promise<void>
  setSession: (payload: { token: string; account: AccountProfile }) => Promise<void>
  clearSession: (notice?: string | null) => Promise<void>
  dismissNotice: () => void
}

export const useAuthSession = create<AuthSessionState>((set) => ({
  isHydrated: false,
  token: null,
  account: null,
  notice: null,
  hydrate: async () => {
    try {
      const token = (await tokenStore.get()) ?? (await migrateLegacyToken())
      const rawAccount =
        (await AsyncStorage.getItem(AUTH_ACCOUNT_KEY)) ??
        (await AsyncStorage.getItem(LEGACY_AUTH_USER_KEY))

      let account: AccountProfile | null = null
      try {
        account = rawAccount ? (JSON.parse(rawAccount) as AccountProfile) : null
      } catch {
        account = null
      }

      set({ token, account: token ? account : null, isHydrated: true })
    } catch {
      set({ token: null, account: null, isHydrated: true })
    }
  },
  setSession: async ({ token, account }) => {
    await tokenStore.set(token)
    await AsyncStorage.setItem(AUTH_ACCOUNT_KEY, JSON.stringify(account))
    set({ token, account, notice: null, isHydrated: true })
  },
  clearSession: async (notice = null) => {
    // Update memory first so in-flight requests stop sending the old token.
    set({ token: null, account: null, notice, isHydrated: true })
    await Promise.all([
      tokenStore.clear(),
      AsyncStorage.removeItem(AUTH_ACCOUNT_KEY).catch(() => undefined),
      AsyncStorage.removeItem(LEGACY_AUTH_USER_KEY).catch(() => undefined),
    ])
  },
  dismissNotice: () => set({ notice: null }),
}))
