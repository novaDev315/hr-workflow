/**
 * Only absolute http(s) links with a host are opened; anything else
 * (javascript:, file:, relative paths, whitespace tricks) returns null.
 * Regex only: React Native's URL polyfill does not implement `protocol`.
 */
export function safeDocumentUrl(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return /^https?:\/\/[a-z0-9.-]+(:\d+)?(\/[^\s]*)?$/i.test(trimmed) ? trimmed : null
}
