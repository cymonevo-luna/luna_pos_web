import { api } from "./client";
import { dateInputToIso } from "./transactions";
import type { CashFlowSummary, TransactionSummaryPeriod } from "./types";

export interface CashFlowSummaryParams {
  period?: TransactionSummaryPeriod;
  dateFrom?: string;
  dateTo?: string;
}

export const cashFlowAdminApi = {
  summary: ({
    period = "daily",
    dateFrom = "",
    dateTo = "",
  }: CashFlowSummaryParams = {}) => {
    const params = new URLSearchParams({ period });
    if (dateFrom) params.set("date_from", dateInputToIso(dateFrom, false));
    if (dateTo) params.set("date_to", dateInputToIso(dateTo, true));
    return api.get<CashFlowSummary>(
      `/api/admin/insights/cash-flow/summary?${params.toString()}`,
    );
  },
};
