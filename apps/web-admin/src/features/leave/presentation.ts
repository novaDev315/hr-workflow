export function leaveStatusTone(status: string) {
  if (status === 'APPROVED') return 'success' as const
  if (status === 'REJECTED') return 'danger' as const
  if (status === 'CANCELLED') return 'neutral' as const
  return 'warning' as const
}
