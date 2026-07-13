import { api, type ApiResult } from "./client";
import { dateInputToIso } from "./transactions";
import type {
  CashFlowInflowByMethod,
  CashFlowInflowByMethodNormalized,
  CashFlowSummary,
  ProductionNextDayInsight,
  TransactionMenuInsights,
  TransactionSummaryPeriod,
} from "./types";

interface CashFlowSummaryRaw
  extends Omit<CashFlowSummary, "inflow_by_method"> {
  inflow_by_method?: CashFlowInflowByMethod[];
}

export function normalizeCashFlowInflowByMethod(
  raw: CashFlowInflowByMethod,
): CashFlowInflowByMethodNormalized {
  return {
    method: raw.method,
    count: raw.count,
    amount: raw.total_amount,
  };
}

export function normalizeCashFlowSummary(raw: CashFlowSummaryRaw): CashFlowSummary {
  return {
    ...raw,
    inflow_by_method: raw.inflow_by_method?.map(normalizeCashFlowInflowByMethod),
  };
}

function normalizeCashFlowSummaryResult(
  result: ApiResult<CashFlowSummaryRaw>,
): ApiResult<CashFlowSummary> {
  return {
    ...result,
    data: normalizeCashFlowSummary(result.data),
  };
}

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
  return api
    .get<CashFlowSummaryRaw>(
      `/api/admin/insights/cash-flow/summary?${params.toString()}`,
    )
    .then(normalizeCashFlowSummaryResult);
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
