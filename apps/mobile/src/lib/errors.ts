import { ApolloError } from '@apollo/client'

export const CONNECTION_MESSAGE = "We couldn't reach HRFlow Pro. Check your connection and try again."

/** A short, readable message for any thrown value or Apollo error. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApolloError) {
    const first = error.graphQLErrors?.[0]?.message
    if (first) return cleanMessage(first) || fallback
    if (error.networkError) {
      // A 400 carries GraphQL validation errors in the response body.
      const bodyErrors = (error.networkError as { result?: { errors?: Array<{ message?: string }> } }).result?.errors
      const bodyMessage = bodyErrors?.[0]?.message
      if (typeof bodyMessage === 'string' && bodyMessage.trim()) return cleanMessage(bodyMessage)
      const status = (error.networkError as { statusCode?: number }).statusCode
      if (status && status >= 500) return 'HRFlow Pro is having trouble right now. Please try again shortly.'
      return CONNECTION_MESSAGE
    }
    return cleanMessage(error.message) || fallback
  }
  if (error instanceof Error) return cleanMessage(error.message) || fallback
  if (typeof error === 'string') return cleanMessage(error) || fallback
  return fallback
}

function cleanMessage(message: string): string {
  return message.replace(/^(GraphQL error|Network error|Error):\s*/i, '').trim()
}

/**
 * Plain-language copy for known backend messages. The server text is written
 * for admins ("Employee has already…"); employees see these instead.
 */
const FRIENDLY_MESSAGES: Array<[RegExp, string | ((match: RegExpExecArray) => string)]> = [
  [/^invalid credentials$/i, "That email and password don't match. Check them and try again."],
  [/must be an email|must be longer than or equal to 8/i, "That email and password don't match. Check them and try again."],
  [/^user account is inactive$/i, 'This account is switched off. Ask your HR team to turn it back on.'],
  [/^employee has already clocked in today$/i, "You've already worked a shift today. You can clock in again tomorrow."],
  [/^employee has already clocked out today$/i, "You've already clocked out today."],
  [/still clocked in from an earlier shift/i, "You're still clocked in from an earlier shift. Clock out first."],
  [/no open attendance record/i, "You're not clocked in, so there is nothing to clock out of."],
  [/older than 24 hours/i, 'Your last clock-in was more than a day ago and was never closed. Ask your HR team to correct it.'],
  [/not assigned to the selected location/i, "You're not assigned to this work site any more. Pull down to refresh your sites."],
  [/^selected location is inactive$/i, 'This work site is closed. Pull down to refresh your sites.'],
  [/overlaps with an existing pending or approved request/i, 'You already have a pending or approved request on some of these days. Change the dates.'],
  [
    /^insufficient (.+) balance for (\d{4}): (.+) requested, ([\d.]+) available$/i,
    (match) => `Not enough ${match[1]} left in ${match[2]}: you asked for ${match[3]} and have ${match[4]}.`,
  ],
  [/contain no working days/i, 'These dates fall on a weekend. Choose dates with at least one working day.'],
  [/more than one year in the past/i, 'The first day can be at most one year ago.'],
  [/more than two years in the future/i, 'The last day can be at most two years from now.'],
  [/only a pending leave request can be cancelled/i, 'This request was already reviewed, so it can no longer be cancelled. Pull down to refresh.'],
  [/^leave type not found or inactive$/i, 'This leave type is no longer offered. Choose another one.'],
]

/** Maps a known backend message to employee-facing copy; returns other messages unchanged. */
export function friendlyMessage(message: string): string {
  for (const [pattern, replacement] of FRIENDLY_MESSAGES) {
    const match = pattern.exec(message.trim())
    if (match) return typeof replacement === 'string' ? replacement : replacement(match)
  }
  return message
}

/** errorMessage, then friendlyMessage. */
export function friendlyErrorMessage(error: unknown, fallback?: string): string {
  return friendlyMessage(errorMessage(error, fallback))
}

/** Meters outside the geofence, from "Outside geofence by 120 meters". */
export function geofenceDistance(message: string): number | null {
  const match = /outside geofence by\s+([\d.,]+)\s*m/i.exec(message)
  if (!match) return null
  const value = Number(match[1].replace(/,/g, ''))
  return Number.isFinite(value) ? Math.round(value) : null
}

/** Friendly copy for clock in/out failures. */
export function clockErrorMessage(
  error: unknown,
  siteName: string | null | undefined,
  action: 'in' | 'out' = 'in',
): string {
  const message = errorMessage(error, "We couldn't record that. Please try again.")
  const meters = geofenceDistance(message)
  if (meters !== null) {
    const place = siteName ? `the ${siteName} area` : 'your work site'
    const distance = String(meters).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return `You're ${distance} m outside ${place}. Move closer to clock ${action}.`
  }
  return friendlyMessage(message)
}
