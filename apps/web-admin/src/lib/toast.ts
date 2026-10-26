import type { ReactNode } from 'react'

export type ToastTone = 'success' | 'danger'
export type ToastItem = { id: number; tone: ToastTone; message: ReactNode }

// One feedback channel for page actions. Messages appear bottom-right (bottom
// on phones) wherever the user is on the page, and are announced politely.
let items: ToastItem[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function push(tone: ToastTone, message: ReactNode) {
  // Keep the stack short; the newest message matters most.
  items = [...items.slice(-2), { id: nextId++, tone, message }]
  emit()
}

export function dismissToast(id: number) {
  items = items.filter((item) => item.id !== id)
  emit()
}

export const toast = {
  success: (message: ReactNode) => push('success', message),
  error: (message: ReactNode) => push('danger', message),
}

export function subscribeToasts(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function currentToasts() {
  return items
}
