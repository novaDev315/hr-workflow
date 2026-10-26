import { create } from 'zustand'

export type FlashTone = 'info' | 'success' | 'warning' | 'danger'

interface FlashState {
  /** One-time confirmation shown by the screen the user lands on, e.g. after a modal closes. */
  flash: { tone: FlashTone; message: string } | null
  showFlash: (message: string, tone?: FlashTone) => void
  clearFlash: () => void
}

export const useFlash = create<FlashState>((set) => ({
  flash: null,
  showFlash: (message, tone = 'success') => set({ flash: { message, tone } }),
  clearFlash: () => set({ flash: null }),
}))
