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

  summary: ({ period, dateFrom = "", dateTo = "" }: SummaryTransactionsParams) => {
    const params = new URLSearchParams({ period });
    if (dateFrom) params.set("date_from", dateInputToIso(dateFrom, false));
    if (dateTo) params.set("date_to", dateInputToIso(dateTo, true));
    return api.get<TransactionSummary>(
      `/api/admin/transactions/summary?${params.toString()}`,
    );
  },
};
