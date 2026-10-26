/**
 * Pure leave-day helpers. All dates are date-only strings (YYYY-MM-DD) and
 * ranges are inclusive. Weekend = Saturday + Sunday (UTC calendar days).
 */

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseDateOnly(value: string): number {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    throw new RangeError(`Invalid date-only value: ${value}`);
  }

  const [, year, month, day] = match;
  const time = Date.UTC(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== value) {
    throw new RangeError(`Invalid date-only value: ${value}`);
  }

  return time;
}

function isWeekend(time: number) {
  const dayOfWeek = new Date(time).getUTCDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/**
 * Working days (Monday-Friday) per calendar year between two inclusive
 * date-only strings. Years without working days are omitted.
 */
export function workingDaysByYear(
  startDate: string,
  endDate: string,
): Map<number, number> {
  const result = new Map<number, number>();
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  for (let time = start; time <= end; time += MILLISECONDS_PER_DAY) {
    if (isWeekend(time)) {
      continue;
    }

    const year = new Date(time).getUTCFullYear();
    result.set(year, (result.get(year) ?? 0) + 1);
  }

  return result;
}

/** Number of working days (Mon-Fri) in the inclusive range, 0 when end < start. */
export function countWorkingDays(startDate: string, endDate: string): number {
  let total = 0;
  for (const days of workingDaysByYear(startDate, endDate).values()) {
    total += days;
  }

  return total;
}
