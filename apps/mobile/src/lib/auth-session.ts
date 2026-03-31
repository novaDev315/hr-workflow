import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'

const AUTH_TOKEN_KEY = 'auth_token'
const AUTH_USER_KEY = 'user'

export interface AuthUser {
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

interface AuthSessionState {
  isHydrated: boolean
  token: string | null
  user: AuthUser | null
  hydrate: () => Promise<void>
  setSession: (payload: { token: string; user: AuthUser }) => Promise<void>
  clearSession: () => Promise<void>
}

export const useAuthSession = create<AuthSessionState>((set) => ({
  isHydrated: false,
  token: null,
  user: null,
  hydrate: async () => {
    try {
      const [token, rawUser] = await Promise.all([
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(AUTH_USER_KEY),
      ])

      set({
        token,
        user: rawUser ? (JSON.parse(rawUser) as AuthUser) : null,
        isHydrated: true,
      })
    } catch {
      set({
        token: null,
        user: null,
        isHydrated: true,
      })
    }
  },
  setSession: async ({ token, user }) => {
    await Promise.all([
      AsyncStorage.setItem(AUTH_TOKEN_KEY, token),
      AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user)),
    ])

    set({
      token,
      user,
      isHydrated: true,
    })
  },
  clearSession: async () => {
    await Promise.all([
      AsyncStorage.removeItem(AUTH_TOKEN_KEY),
      AsyncStorage.removeItem(AUTH_USER_KEY),
    ])

    set({
      token: null,
      user: null,
      isHydrated: true,
    })
  },
}))
