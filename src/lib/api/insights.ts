import { api, type ApiResult } from "./client";
import { dateInputToIso } from "./transactions";
import type {
  CashFlowInflowByMethod,
  CashFlowInflowByMethodNormalized,
  CashFlowSummary,
  ProductionNextDayInsight,
  ProductionNextDayInsightItem,
  ProductionNextDayInsightItemRaw,
  ProductionNextDayInsightRaw,
  TransactionMenuInsightItem,
  TransactionMenuInsightItemRaw,
  TransactionMenuInsights,
  TransactionMenuInsightsRaw,
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

function coerceFiniteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function coerceMaxProducible(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return coerceFiniteNumber(value);
}

export function normalizeProductionNextDayInsightItem(
  raw: ProductionNextDayInsightItemRaw,
): ProductionNextDayInsightItem {
  return {
    menu_id: raw.menu_id,
    menu_title: raw.menu_title,
    current_stock: coerceFiniteNumber(raw.current_available_stock),
    avg_daily_sales: coerceFiniteNumber(raw.avg_daily_sales),
    projected_demand: coerceFiniteNumber(raw.projected_demand),
    recommended_production_qty: coerceFiniteNumber(raw.recommended_production_qty),
    max_producible: coerceMaxProducible(raw.max_producible_from_ingredients),
    confidence: raw.confidence,
    limited_by_ingredients: Boolean(raw.is_limited_by_ingredients),
  };
}

export function normalizeProductionNextDayInsight(
  raw: ProductionNextDayInsightRaw,
): ProductionNextDayInsight {
  const menus = raw.menus ?? [];
  return {
    target_date: raw.target_date,
    lookback_days: raw.lookback_days,
    generated_at: raw.generated_at,
    items: menus.map(normalizeProductionNextDayInsightItem),
  };
}

export async function productionNextDayInsight({
  lookbackDays = 14,
}: ProductionNextDayInsightParams = {}) {
  const params = new URLSearchParams({
    lookback_days: String(lookbackDays),
  });
  const result = await api.get<ProductionNextDayInsightRaw>(
    `/api/admin/insights/production/next-day?${params.toString()}`,
  );
  return {
    ...result,
    data: result.data
      ? normalizeProductionNextDayInsight(result.data)
      : undefined,
  };
}

export const insightsAdminApi = {
  cashFlowSummary,
  transactionMenuInsights,
  productionNextDayInsight,
};
