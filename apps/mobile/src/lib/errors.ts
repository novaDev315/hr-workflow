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
  return message
}
