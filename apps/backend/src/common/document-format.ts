/**
 * Human-readable formatting shared by the generated PDF documents (payslips,
 * operational report). Pure functions, no I/O.
 */

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_SHORT = MONTH_NAMES.map((name) => name.slice(0, 3));

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) {
    return null;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return { year, month, day };
}

/** "2026-08" -> "August 2026". Unparseable input is returned unchanged. */
export function formatPeriodMonth(periodMonth: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(periodMonth.trim());
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) {
    return periodMonth;
  }
  return `${MONTH_NAMES[Number(match[2]) - 1]} ${match[1]}`;
}

/** "2026-08-01" -> "1 Aug 2026". Unparseable input is returned unchanged. */
export function formatIsoDate(value: string) {
  const parts = parseIsoDate(value);
  if (!parts) {
    return value;
  }
  return `${parts.day} ${MONTH_SHORT[parts.month - 1]} ${parts.year}`;
}

/**
 * "2026-08-01","2026-08-31" -> "1 – 31 Aug 2026"; across months
 * "1 Aug – 5 Sep 2026"; across years "30 Dec 2026 – 2 Jan 2027".
 * The dash is an en dash (U+2013), which the PDF Latin-1 font cannot draw, so
 * the PDF output uses " - " via `asciiDash` when requested.
 */
export function formatDateRange(startDate: string, endDate: string, dash = '–') {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end) {
    return `${startDate} ${dash} ${endDate}`;
  }
  if (startDate.slice(0, 10) === endDate.slice(0, 10)) {
    return formatIsoDate(startDate);
  }
  if (start.year === end.year && start.month === end.month) {
    return `${start.day} ${dash} ${end.day} ${MONTH_SHORT[end.month - 1]} ${end.year}`;
  }
  if (start.year === end.year) {
    return `${start.day} ${MONTH_SHORT[start.month - 1]} ${dash} ${end.day} ${MONTH_SHORT[end.month - 1]} ${end.year}`;
  }
  return `${formatIsoDate(startDate)} ${dash} ${formatIsoDate(endDate)}`;
}

/** "PAID" / "PENDING_APPROVAL" -> "Paid" / "Pending approval". */
export function humanizeStatus(status: string) {
  const words = status.trim().replace(/[_\s]+/g, ' ').toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : words;
}

/** 4500 -> "4,500.00" (en-US grouping, fixed 2 decimals). */
export function formatAmount(value: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

/** 4500, "AED" -> "AED 4,500.00". */
export function formatMoney(value: number, currencyCode?: string | null) {
  const amount = formatAmount(value);
  return currencyCode?.trim() ? `${currencyCode.trim()} ${amount}` : amount;
}

/** Falls back to UTC when the zone is missing or not a valid IANA name. */
export function resolveTimeZone(timeZone?: string | null) {
  const candidate = timeZone?.trim();
  if (!candidate) {
    return 'UTC';
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate });
    return candidate;
  } catch {
    return 'UTC';
  }
}

/** "26 Oct 2026, 19:28 (Asia/Dubai)" in the given zone (UTC fallback). */
export function formatGeneratedAt(date: Date, timeZone?: string | null) {
  const zone = resolveTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')} (${zone})`;
}

/** pluralize(1, 'employee') -> "1 employee"; pluralize(6, 'employee') -> "6 employees". */
export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
