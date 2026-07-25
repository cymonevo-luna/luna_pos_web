import {
  defaultReportRange,
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
