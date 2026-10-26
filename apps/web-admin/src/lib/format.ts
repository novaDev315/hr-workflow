// Shared display formatters. Pages should never print raw ISO dates, enum
// values, unformatted amounts, or "day(s)"-style plurals.

const LOCALE = "en-AE";

export function formatMoney(
  amount: number | null | undefined,
  currencyCode = "AED",
): string {
  const value = Number.isFinite(amount) ? Number(amount) : 0;

  try {
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency: currencyCode || "AED",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currencyCode} ${value.toFixed(2)}`;
  }
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  const safe = Number.isFinite(value) ? Number(value) : 0;
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(safe);
}

// Date-only strings ("2026-11-10") are calendar dates, not instants: format
// them in UTC so browsers west of UTC don't show the previous day.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function formatDay(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const isDateOnly = typeof value === "string" && DATE_ONLY.test(value);
  const date = isDateOnly ? new Date(`${value}T00:00:00Z`) : toDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(isDateOnly ? { timeZone: "UTC" } : {}),
  }).format(date);
}

export function formatDayRange(start: string, end: string): string {
  return start === end ? formatDay(start) : `${formatDay(start)} – ${formatDay(end)}`;
}

// "2026-10" -> "October 2026"
export function formatMonth(periodMonth: string | null | undefined): string {
  if (!periodMonth || !/^\d{4}-\d{2}$/.test(periodMonth)) return periodMonth ?? "—";
  return new Intl.DateTimeFormat(LOCALE, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${periodMonth}-01T00:00:00Z`));
}

export function formatTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(LOCALE, { hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

// Accepts ISO strings and Postgres text timestamps ("2026-10-25 18:46:18+00").
export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const normalized = value
    .trim()
    .replace(" ", "T")
    .replace(/([+-]\d{2})$/, "$1:00");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

// "3 days", "1 day", "1 employee"
export function plural(count: number, singular: string, pluralForm?: string): string {
  const word = count === 1 ? singular : pluralForm ?? `${singular}s`;
  return `${formatNumber(count, Number.isInteger(count) ? 0 : 1)} ${word}`;
}

const STATUS_LABELS: Record<string, string> = {
  CLOCKED_IN: "Clocked in",
  COMPLETED: "Completed",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
  PROCESSED: "Processed",
  GENERATED: "Generated",
  PAID: "Paid",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ON_LEAVE: "On leave",
  TERMINATED: "Terminated",
  OPEN: "Open",
  ON_HOLD: "On hold",
  FILLED: "Filled",
  CLOSED: "Closed",
  RECEIVED: "Received",
  SCREENING: "Screening",
  INTERVIEW_SCHEDULED: "Interview scheduled",
  INTERVIEWED: "Interviewed",
  SELECTED: "Selected",
  OFFER_EXTENDED: "Offer extended",
  HIRED: "Hired",
  WITHDRAWN: "Withdrawn",
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  CONTRACT: "Contract",
  INTERN: "Intern",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  URGENT: "Urgent",
  ADMIN: "Admin",
  HR_ADMIN: "HR admin",
  MANAGER: "Manager",
  SUPERVISOR: "Supervisor",
  EMPLOYEE: "Employee",
};

export function formatStatus(value: string | null | undefined): string {
  if (!value) return "—";
  return (
    STATUS_LABELS[value] ??
    value
      .toLowerCase()
      .split("_")
      .map((part, index) => (index === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
      .join(" ")
  );
}

// Only http(s) links may be rendered as hrefs; anything else (javascript:,
// data:, relative junk) is dropped.
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// Local calendar date in the browser ("YYYY-MM-DD"), not the UTC date.
export function todayLocal(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function currentMonthLocal(): string {
  return todayLocal().slice(0, 7);
}
