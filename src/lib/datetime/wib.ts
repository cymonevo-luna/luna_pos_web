/** Hardcoded business timezone: Western Indonesian Time (GMT+07:00). */
export const WIB_TIMEZONE = "Asia/Jakarta";

export type WibFormatPattern = "date" | "datetime" | "short" | "long";

const WIB_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: WIB_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const WIB_FORMATTERS: Record<WibFormatPattern, Intl.DateTimeFormat> = {
  date: new Intl.DateTimeFormat("en", {
    timeZone: WIB_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
  }),
  datetime: new Intl.DateTimeFormat("en", {
    timeZone: WIB_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }),
  short: new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
  }),
  long: new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB_TIMEZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }),
};

function toDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day - 1, 17, 0, 0, 0));
  }
  return new Date(trimmed);
}

function formatWibDateString(date: Date): string {
  return WIB_DATE_FORMATTER.format(date);
}

function parseWibDateParts(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year, month, day };
}

function wibInstant(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): Date {
  return new Date(
    Date.UTC(year, month - 1, day, hour - 7, minute, second, millisecond),
  );
}

/** Current instant (same as `new Date()`); use with WIB formatters for display. */
export function nowWIB(): Date {
  return new Date();
}

/** Today's calendar date in WIB as `YYYY-MM-DD`. */
export function todayWIB(): string {
  return formatWibDateString(new Date());
}

/** Format a date for display in WIB. */
export function formatWIB(date: Date | string, pattern: WibFormatPattern = "date"): string {
  const parsed = toDate(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  return WIB_FORMATTERS[pattern].format(parsed);
}

/** Start of a WIB calendar day (for display/comparison only). */
export function startOfDayWIB(dateStr: string): Date {
  const { year, month, day } = parseWibDateParts(dateStr);
  return wibInstant(year, month, day, 0, 0, 0, 0);
}

/** End of a WIB calendar day (for display/comparison only). */
export function endOfDayWIB(dateStr: string): Date {
  const { year, month, day } = parseWibDateParts(dateStr);
  return wibInstant(year, month, day, 23, 59, 59, 999);
}

/** Last 30 WIB calendar days through today (inclusive). */
export function defaultReportRange(): { dateFrom: string; dateTo: string } {
  const dateTo = todayWIB();
  const anchor = startOfDayWIB(dateTo);
  anchor.setUTCDate(anchor.getUTCDate() - 30);
  return {
    dateFrom: formatWibDateString(anchor),
    dateTo,
  };
}

/** Serialize a date as `YYYY-MM-DD` in WIB for API `date_from` / `date_to` params. */
export function toApiDateParam(date: Date | string): string {
  return formatWibDateString(toDate(date));
}
