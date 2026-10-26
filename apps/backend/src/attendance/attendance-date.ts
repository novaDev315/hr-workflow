export const DEFAULT_COMPANY_TIMEZONE = 'Asia/Dubai';

/** Returns a valid IANA zone, falling back to the company default for empty or unknown values. */
export function resolveTimeZone(timeZone?: string | null) {
  const candidate = timeZone?.trim();
  if (!candidate) {
    return DEFAULT_COMPANY_TIMEZONE;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate });
    return candidate;
  } catch {
    return DEFAULT_COMPANY_TIMEZONE;
  }
}

/** Calendar date (YYYY-MM-DD) of an instant as seen in the given time zone. */
export function attendanceDateInTimeZone(instant: Date, timeZone?: string | null) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);

  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

/** ISO-8601 string for a timestamp value, or null. */
export function toIsoTimestamp(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export const MAX_OPEN_SHIFT_MS = 24 * 60 * 60 * 1000;
