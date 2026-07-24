import { api } from "./client";
import type {
  Transaction,
  TransactionMethod,
  TransactionSummary,
  TransactionSummaryPeriod,
} from "./types";

export interface ListTransactionsParams {
  page?: number;
  perPage?: number;
  method?: TransactionMethod | "";
  dateFrom?: string;
  dateTo?: string;
  cashierUsername?: string;
}

export interface SummaryTransactionsParams {
  period: TransactionSummaryPeriod;
  dateFrom?: string;
  dateTo?: string;
}

/** Format an ISO8601 timestamp for `<input type="datetime-local" />`. */
export function isoToDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parse a `datetime-local` value to ISO8601 for the API. */
export function datetimeLocalToIso(value: string): string {
  return new Date(value).toISOString();
}

/** Serialize a date input value (YYYY-MM-DD) to ISO8601 for the API. */
export function dateInputToIso(value: string, endOfDay = false): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0,
    ),
  );
  return date.toISOString();
}

export const transactionsAdminApi = {
  list: ({
    page = 1,
    perPage = 10,
    method = "",
    dateFrom = "",
    dateTo = "",
    cashierUsername = "",
  }: ListTransactionsParams = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (method) params.set("method", method);
    if (dateFrom) params.set("date_from", dateInputToIso(dateFrom, false));
    if (dateTo) params.set("date_to", dateInputToIso(dateTo, true));
    if (cashierUsername) params.set("cashier_username", cashierUsername);
    return api.get<Transaction[]>(`/api/admin/transactions?${params.toString()}`);
  },

  get: (id: string) => api.get<Transaction>(`/api/admin/transactions/${id}`),

  delete: (id: string) =>
    api.delete<void>(`/api/admin/transactions/${id}`),

  updateRecordDate: (id: string, transactionDate: string) =>
    api.patch<Transaction>(`/api/admin/transactions/${id}/record-date`, {
      transaction_date: transactionDate,
    }),

  summary: ({ period, dateFrom = "", dateTo = "" }: SummaryTransactionsParams) => {
    const params = new URLSearchParams({ period });
    if (dateFrom) params.set("date_from", dateInputToIso(dateFrom, false));
    if (dateTo) params.set("date_to", dateInputToIso(dateTo, true));
    return api.get<TransactionSummary>(
      `/api/admin/transactions/summary?${params.toString()}`,
    );
  },
};
