import { api } from "./client";
import { dateInputToIso } from "./transactions";
import type {
  Transaction,
  TransactionSummary,
  TransactionSummaryPeriod,
} from "./types";

export interface ListPosTransactionsParams {
  page?: number;
  perPage?: number;
  dateFrom?: string;
  dateTo?: string;
  cashierUserId?: string;
}

export interface SummaryPosTransactionsParams {
  period: TransactionSummaryPeriod;
  dateFrom?: string;
  dateTo?: string;
}

export const transactionsPosApi = {
  list: ({
    page = 1,
    perPage = 10,
    dateFrom = "",
    dateTo = "",
    cashierUserId = "",
  }: ListPosTransactionsParams = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (dateFrom) params.set("date_from", dateInputToIso(dateFrom, false));
    if (dateTo) params.set("date_to", dateInputToIso(dateTo, true));
    if (cashierUserId) params.set("cashier_user_id", cashierUserId);
    return api.get<Transaction[]>(
      `/api/v1/pos/transactions?${params.toString()}`,
    );
  },

  get: (id: string) =>
    api.get<Transaction>(`/api/v1/pos/transactions/${id}`),

  summary: ({ period, dateFrom = "", dateTo = "" }: SummaryPosTransactionsParams) => {
    const params = new URLSearchParams({ period });
    if (dateFrom) params.set("date_from", dateInputToIso(dateFrom, false));
    if (dateTo) params.set("date_to", dateInputToIso(dateTo, true));
    return api.get<TransactionSummary>(
      `/api/v1/pos/transactions/summary?${params.toString()}`,
    );
  },
};
