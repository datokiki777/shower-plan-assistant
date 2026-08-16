/**
 * Business dates (jobDate, stay entry/exit) are calendar-day values, not
 * instants. They must never round-trip through `new Date(...).toISOString()`
 * (which converts to UTC and can shift the date by a day depending on the
 * user's timezone/time of day). V1 got this right by keeping these as plain
 * "YYYY-MM-DD" strings straight from `<input type="date">` - see
 * DATA_MODEL.md. V2 keeps the same strategy, formalized here.
 */

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnlyString(value: string): boolean {
  return DATE_ONLY_RE.test(value);
}

/** For display only. Parses a "YYYY-MM-DD" string as a LOCAL calendar date
 * (not UTC midnight, which `new Date("YYYY-MM-DD")` would do and which can
 * display as the previous day in negative-UTC-offset timezones). */
export function formatDateOnly(value: string | null, locale = "ka-GE"): string {
  if (!value || !isDateOnlyString(value)) return "—";
  const [year, month, day] = value.split("-").map(Number);
  const local = new Date(year as number, (month as number) - 1, day as number);
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(local);
}

/** Today as a "YYYY-MM-DD" string in the user's local timezone (not UTC). */
export function todayDateOnly(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
