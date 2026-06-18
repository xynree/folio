const SHORT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

const TIMESTAMP_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

/**
 * Formats an ISO date string with the given options, returning `null` when the
 * value cannot be parsed so callers can choose their own fallback label.
 */
function formatWithOptions(
  value: string,
  options: Intl.DateTimeFormatOptions,
): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

/** Short calendar date (e.g. "Jun 17, 2026"); "None" when empty, "Unknown" when invalid. */
export function formatShortDate(value: string | null): string {
  if (!value) return "None";
  return formatWithOptions(value, SHORT_DATE_OPTIONS) ?? "Unknown";
}

/** Short calendar date for review timestamps; "Unknown date" when invalid. */
export function formatReviewTimestamp(value: string): string {
  return formatWithOptions(value, SHORT_DATE_OPTIONS) ?? "Unknown date";
}

/** Calendar date with time of day (e.g. "Jun 17, 2026, 4:05 PM"); "Unknown" when empty or invalid. */
export function formatBoardTimestamp(value?: string): string {
  if (!value) return "Unknown";
  return formatWithOptions(value, TIMESTAMP_OPTIONS) ?? "Unknown";
}

/** Returns a new date offset from `date` by the given number of days. */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Parses an ISO date string into a sortable epoch millisecond value, falling
 * back to 0 for empty or unparseable input.
 */
export function parseTimestamp(value: string): number {
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}
