import { api } from "./client";
import { dateInputToIso } from "./transactions";
import type {
  CashFlowSummary,
  ProductionNextDayInsight,
  TransactionMenuInsights,
  TransactionSummaryPeriod,
} from "./types";

export interface CashFlowSummaryParams {
  period?: TransactionSummaryPeriod;
  dateFrom?: string;
  dateTo?: string;
}

export interface TransactionMenuInsightsParams {
  dateFrom?: string;
  dateTo?: string;
}

export interface ProductionNextDayInsightParams {
  lookbackDays?: number;
}

export function cashFlowSummary({
  period = "daily",
  dateFrom = "",
  dateTo = "",
}: CashFlowSummaryParams = {}) {
  const params = new URLSearchParams({ period });
  if (dateFrom) params.set("date_from", dateInputToIso(dateFrom, false));
  if (dateTo) params.set("date_to", dateInputToIso(dateTo, true));
  return api.get<CashFlowSummary>(
    `/api/admin/insights/cash-flow/summary?${params.toString()}`,
  );
}

export function transactionMenuInsights({
  dateFrom = "",
  dateTo = "",
}: TransactionMenuInsightsParams = {}) {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateInputToIso(dateFrom, false));
  if (dateTo) params.set("date_to", dateInputToIso(dateTo, true));
  return api.get<TransactionMenuInsights>(
    `/api/admin/insights/transactions/by-menu?${params.toString()}`,
  );
}

export function productionNextDayInsight({
  lookbackDays = 14,
}: ProductionNextDayInsightParams = {}) {
  const params = new URLSearchParams({
    lookback_days: String(lookbackDays),
  });
  return api.get<ProductionNextDayInsight>(
    `/api/admin/insights/production/next-day?${params.toString()}`,
  );
}

export const insightsAdminApi = {
  cashFlowSummary,
  transactionMenuInsights,
  productionNextDayInsight,
};
