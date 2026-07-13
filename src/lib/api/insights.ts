import { api, type ApiResult } from "./client";
import { dateInputToIso } from "./transactions";
import type {
  CashFlowSummary,
  ProductionNextDayInsight,
  TransactionMenuInsightItem,
  TransactionMenuInsightItemRaw,
  TransactionMenuInsights,
  TransactionMenuInsightsRaw,
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

function normalizeTransactionMenuInsightItem(
  raw: TransactionMenuInsightItemRaw,
): TransactionMenuInsightItem {
  return {
    menu_id: raw.menu_id,
    menu_title: raw.menu_title,
    quantity_sold: raw.quantity_sold,
    revenue: raw.revenue,
    share_percent: raw.revenue_share_percent,
    quantity_share_percent: raw.quantity_share_percent,
  };
}

function normalizeTransactionMenuInsights(
  raw: TransactionMenuInsightsRaw,
): TransactionMenuInsights {
  return {
    ...raw,
    menus: raw.menus.map(normalizeTransactionMenuInsightItem),
  };
}

function normalizeTransactionMenuInsightsResult(
  result: ApiResult<TransactionMenuInsightsRaw>,
): ApiResult<TransactionMenuInsights> {
  return {
    ...result,
    data: normalizeTransactionMenuInsights(result.data),
  };
}

export async function transactionMenuInsights({
  dateFrom = "",
  dateTo = "",
}: TransactionMenuInsightsParams = {}) {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateInputToIso(dateFrom, false));
  if (dateTo) params.set("date_to", dateInputToIso(dateTo, true));
  const result = await api.get<TransactionMenuInsightsRaw>(
    `/api/admin/insights/transactions/by-menu?${params.toString()}`,
  );
  return normalizeTransactionMenuInsightsResult(result);
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
