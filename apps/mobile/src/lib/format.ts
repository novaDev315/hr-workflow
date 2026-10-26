/**
 * Display formatting for the mobile app. All dates and times are shown in the
 * device's local time. Month and weekday names are fixed English strings so the
 * output does not depend on the JS engine's Intl date support.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const pad = (value: number) => String(value).padStart(2, '0')

/**
 * Parses a backend timestamp. Accepts ISO 8601 ("2026-10-25T18:46:18.000Z"),
 * Postgres text ("2026-10-25 18:46:18+00", "...+04:00", "...+0400") and epoch
 * milliseconds. Returns null for anything unparseable.
 */
export function parseTimestamp(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const raw = value.trim()
  if (/^\d{10,}$/.test(raw)) return parseTimestamp(Number(raw))
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return parseDateOnly(raw)

  let normalized = raw.replace(' ', 'T')
  normalized = normalized.replace(/([+-]\d{2})$/, '$1:00').replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
  // Trim fractional seconds beyond milliseconds, which some engines reject.
  normalized = normalized.replace(/(\.\d{3})\d+/, '$1')
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Parses "YYYY-MM-DD" (or a longer ISO string) as a local calendar date. */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(value.trim())
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3] ?? '1'))
  return Number.isNaN(date.getTime()) ? null : date
}

/** Local calendar date as "YYYY-MM-DD". */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayKey(): string {
  return toDateKey(new Date())
}

/** "7:12 PM" — 12-hour clock, matching the web admin. A no-break space keeps "PM" with its time. */
export function formatTime(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseTimestamp(value)
  if (!date) return '—'
  const hours = date.getHours()
  return `${hours % 12 || 12}:${pad(date.getMinutes())}\u00a0${hours < 12 ? 'AM' : 'PM'}`
}

/** "Sat, 25 Oct" */
export function formatShortDate(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseDateOnly(value)
  if (!date) return '—'
  return `${WEEKDAYS_SHORT[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)}`
}

/** "25 October 2026" */
export function formatLongDate(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseDateOnly(value)
  if (!date) return '—'
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

/** "12 Nov 2026", or "12 – 14 Nov 2026" / "28 Oct – 3 Nov 2026" for ranges. */
export function formatDateRange(start: string, end: string): string {
  const from = parseDateOnly(start)
  const to = parseDateOnly(end)
  if (!from || !to) return `${start} – ${end}`
  const month = (date: Date) => MONTHS[date.getMonth()].slice(0, 3)
  if (toDateKey(from) === toDateKey(to)) {
    return `${from.getDate()} ${month(from)} ${from.getFullYear()}`
  }
  if (from.getFullYear() !== to.getFullYear()) {
    return `${from.getDate()} ${month(from)} ${from.getFullYear()} – ${to.getDate()} ${month(to)} ${to.getFullYear()}`
  }
  if (from.getMonth() !== to.getMonth()) {
    return `${from.getDate()} ${month(from)} – ${to.getDate()} ${month(to)} ${to.getFullYear()}`
  }
  return `${from.getDate()} – ${to.getDate()} ${month(to)} ${to.getFullYear()}`
}

/** "September 2026" from "2026-09", "2026-09-01" or a timestamp. */
export function formatMonth(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseDateOnly(value ?? '')
  if (!date) return value ? String(value) : '—'
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

/** Sort/group key "YYYY-MM". */
export function monthKey(value: string): string {
  return value.slice(0, 7)
}

function groupThousands(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** "AED 12,450.00" — Intl when available, otherwise a manual fallback. */
export function formatMoney(amount: number | null | undefined, currencyCode = 'AED'): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—'
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'code',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .format(amount)
      .replace(/ /g, ' ')
  } catch {
    const sign = amount < 0 ? '-' : ''
    const [whole, cents] = Math.abs(amount).toFixed(2).split('.')
    return `${sign}${currencyCode} ${groupThousands(whole)}.${cents}`
  }
}

/** Up to two decimals without trailing zeros: 3, 2.5, 7.25 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return String(Number(value.toFixed(2)))
}

/** plural(1, 'day') → "1 day", plural(3, 'working day') → "3 working days" */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`
}

/** "8.5 hours" or "45 min" */
export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return '—'
  if (hours < 1) return `${Math.round(hours * 60)} min`
  return plural(Number(hours.toFixed(1)), 'hour')
}

/** "HR_ADMIN" → "Hr admin" fallback for unknown enums. */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return '—'
  const words = value.toLowerCase().replace(/[_-]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

const ATTENDANCE_STATUS: Record<string, { label: string; tone: Tone }> = {
  CLOCKED_IN: { label: 'Clocked in', tone: 'info' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  ABSENT: { label: 'Absent', tone: 'danger' },
  LATE: { label: 'Late', tone: 'warning' },
  ON_LEAVE: { label: 'On leave', tone: 'neutral' },
}

const LEAVE_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: 'Pending', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
}

const PAYSLIP_STATUS: Record<string, { label: string; tone: Tone }> = {
  PAID: { label: 'Paid', tone: 'success' },
  GENERATED: { label: 'Prepared', tone: 'neutral' },
  PROCESSED: { label: 'Processed', tone: 'neutral' },
}

const EMPLOYEE_STATUS: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  ON_LEAVE: 'On leave',
  PROBATION: 'On probation',
  TERMINATED: 'Left the company',
}

const ROLE_NAMES: Record<string, string> = {
  ADMIN: 'Administrator',
  HR_ADMIN: 'HR administrator',
  MANAGER: 'Manager',
  SUPERVISOR: 'Supervisor',
  EMPLOYEE: 'Employee',
}

const lookup = (table: Record<string, { label: string; tone: Tone }>, value: string | null | undefined) =>
  table[(value ?? '').toUpperCase()] ?? { label: humanizeEnum(value), tone: 'neutral' as Tone }

export const attendanceStatus = (value: string | null | undefined) => lookup(ATTENDANCE_STATUS, value)
export const leaveStatus = (value: string | null | undefined) => lookup(LEAVE_STATUS, value)
export const payslipStatus = (value: string | null | undefined) => lookup(PAYSLIP_STATUS, value)

export const employeeStatusLabel = (value: string | null | undefined) =>
  EMPLOYEE_STATUS[(value ?? '').toUpperCase()] ?? humanizeEnum(value)

export const roleLabel = (value: string) => ROLE_NAMES[value.toUpperCase()] ?? humanizeEnum(value)

export function formatRoles(roles: string[] | null | undefined): string {
  if (!roles || roles.length === 0) return 'Employee'
  return roles.map(roleLabel).join(', ')
}

/** Greeting by device-local time of day. */
export function greetingFor(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 5) return 'Good evening'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Working days (Monday–Friday) between two calendar dates, inclusive.
 * Mirrors the backend's weekday rule; the server stays authoritative.
 */
export function countWorkingDays(start: Date, end: Date): number {
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  let count = 0
  while (cursor <= last) {
    const day = cursor.getDay()
    if (day !== 0 && day !== 6) count += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'
}
