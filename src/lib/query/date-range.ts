import {
  defaultReportRange,
  startOfMonthWIB,
  startOfWeekWIB,
  todayWIB,
  toApiDateParam,
} from "@/lib/datetime/wib";

export function formatDateInput(date: Date): string {
  return toApiDateParam(date);
}

/** Last 30 WIB days through today — shared by overview stats and analytics chart. */
export function getDefaultTransactionDateRange() {
  return defaultReportRange();
}

export function getTodayDateInput(): string {
  return todayWIB();
}

export type DateRangePreset = "all" | "today" | "week" | "month" | "custom";

export const DATE_RANGE_PRESET_OPTIONS: Array<{
  value: DateRangePreset;
  label: string;
}> = [
  { value: "all", label: "All dates" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom range" },
];

/** Resolve preset labels to inclusive WIB calendar-day bounds. */
export function getPresetDateRange(preset: Exclude<DateRangePreset, "all" | "custom">) {
  const today = todayWIB();
  switch (preset) {
    case "today":
      return { dateFrom: today, dateTo: today };
    case "week":
      return { dateFrom: startOfWeekWIB(today), dateTo: today };
    case "month":
      return { dateFrom: startOfMonthWIB(today), dateTo: today };
  }
}

/** Append WIB `YYYY-MM-DD` bounds for admin history list endpoints. */
export function appendHistoryDateParams(
  params: URLSearchParams,
  dateFrom = "",
  dateTo = "",
) {
  if (dateFrom) params.set("date_from", toApiDateParam(dateFrom));
  if (dateTo) params.set("date_to", toApiDateParam(dateTo));
}
