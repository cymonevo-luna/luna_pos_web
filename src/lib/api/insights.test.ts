import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cashFlowSummary,
  normalizeCashFlowOutflowBySource,
  normalizeCashFlowProductionCost,
  normalizeCashFlowSummary,
  normalizeProductionNextDayInsight,
  productionNextDayInsight,
  transactionMenuInsights,
} from "./insights";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("insights API", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds the cash flow summary URL and unwraps the response", async () => {
    const summary = {
      period: "daily",
      totals: {
        inflow_amount: 1_200_000,
        inflow_count: 12,
        outflow_amount: 450_000,
        outflow_count: 2,
        net_amount: 750_000,
      },
      buckets: [],
      inflow_by_method: [
        { method: "CASH", total_amount: 1_000_000, count: 7 },
        { method: "QRIS", total_amount: 200_000, count: 5 },
      ],
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: summary }),
    );

    const got = await cashFlowSummary({
      period: "daily",
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/insights/cash-flow/summary?period=daily&date_from=2026-07-13T00%3A00%3A00.000Z&date_to=2026-07-13T23%3A59%3A59.999Z",
    );
    expect(got.data.inflow_by_method).toEqual([
      { method: "CASH", amount: 1_000_000, count: 7 },
      { method: "QRIS", amount: 200_000, count: 5 },
    ]);
  });

  it("maps outflow_by_source and production_cost fields from the cash flow summary API", async () => {
    const summary = {
      period: "daily",
      totals: {
        inflow_amount: 1_200_000,
        inflow_count: 12,
        outflow_amount: 450_000,
        outflow_count: 4,
        net_amount: 750_000,
      },
      buckets: [
        {
          period_start: "2026-07-13T00:00:00Z",
          period_label: "Jul 13",
          inflow_amount: 1_200_000,
          outflow_amount: 450_000,
          net_amount: 750_000,
          production_cost_amount: 120_000,
        },
      ],
      inflow_by_method: [],
      outflow_by_source: [
        { source: "purchases", total_amount: 250_000, count: 2 },
        { source: "expenses", total_amount: 100_000, count: 1 },
        { source: "staff_payouts", total_amount: 100_000, count: 1 },
      ],
      production_cost: {
        total_estimated_cost: 120_000,
        completed_request_count: 3,
        items_without_cogs_count: 1,
      },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: summary }),
    );

    const got = await cashFlowSummary({
      period: "daily",
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
    });

    expect(got.data.outflow_by_source).toEqual([
      { source: "purchases", amount: 250_000, count: 2 },
      { source: "expenses", amount: 100_000, count: 1 },
      { source: "staff_payouts", amount: 100_000, count: 1 },
    ]);
    expect(got.data.production_cost).toEqual({
      total_estimated_cost: 120_000,
      completed_request_count: 3,
      items_without_cogs_count: 1,
    });
    expect(got.data.buckets[0]?.production_cost_amount).toBe(120_000);
  });

  it("normalizes cash flow summary without optional extended fields", () => {
    const normalized = normalizeCashFlowSummary({
      period: "daily",
      totals: {
        inflow_amount: 0,
        inflow_count: 0,
        outflow_amount: 0,
        outflow_count: 0,
        net_amount: 0,
      },
      buckets: [],
    });

    expect(normalized.outflow_by_source).toBeUndefined();
    expect(normalized.production_cost).toBeUndefined();
  });

  it("coerces invalid numeric values in outflow and production cost normalizers", () => {
    expect(
      normalizeCashFlowOutflowBySource({
        source: "expenses",
        total_amount: "invalid" as unknown as number,
        count: "2" as unknown as number,
      }),
    ).toEqual({
      source: "expenses",
      amount: 0,
      count: 2,
    });

    expect(
      normalizeCashFlowProductionCost({
        total_estimated_cost: null as unknown as number,
        completed_request_count: undefined as unknown as number,
        items_without_cogs_count: "1" as unknown as number,
      }),
    ).toEqual({
      total_estimated_cost: 0,
      completed_request_count: 0,
      items_without_cogs_count: 1,
    });
  });

  it("builds the transaction menu insights URL", async () => {
    const insights = {
      date_from: "2026-07-01T00:00:00.000Z",
      date_to: "2026-07-13T23:59:59.999Z",
      total_revenue: 500_000,
      menus: [],
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: insights }),
    );

    await transactionMenuInsights({
      dateFrom: "2026-07-01",
      dateTo: "2026-07-13",
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/admin/insights/transactions/by-menu?");
    expect(url).toContain("date_from=2026-07-01");
    expect(url).toContain("date_to=2026-07-13");
  });

  it("maps revenue_share_percent to share_percent", async () => {
    const insights = {
      date_from: "2026-07-01T00:00:00.000Z",
      date_to: "2026-07-13T23:59:59.999Z",
      total_revenue: 500_000,
      menus: [
        {
          menu_id: "menu-1",
          menu_title: "Nasi Goreng",
          quantity_sold: 20,
          revenue: 300_000,
          revenue_share_percent: 60,
          quantity_share_percent: 66.7,
        },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: insights }),
    );

    const got = await transactionMenuInsights({
      dateFrom: "2026-07-01",
      dateTo: "2026-07-13",
    });

    expect(got.data?.menus[0]?.share_percent).toBe(60);
    expect(got.data?.menus[0]?.quantity_share_percent).toBe(66.7);
  });

  it("builds the production next-day insight URL and maps menus to items", async () => {
    const backendPayload = {
      target_date: "2026-07-14",
      lookback_days: 14,
      generated_at: "2026-07-13T10:00:00.000Z",
      menus: [
        {
          menu_id: "menu-1",
          menu_title: "Nasi Goreng",
          current_available_stock: 5,
          avg_daily_sales: 8,
          projected_demand: 10,
          recommended_production_qty: 5,
          max_producible_from_ingredients: 12,
          confidence: "high",
          is_limited_by_ingredients: false,
        },
        {
          menu_id: "menu-2",
          menu_title: "Mie Goreng",
          current_available_stock: 20,
          avg_daily_sales: 3,
          projected_demand: 4,
          recommended_production_qty: 3,
          max_producible_from_ingredients: 3,
          confidence: "medium",
          is_limited_by_ingredients: true,
        },
      ],
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: backendPayload }),
    );

    const got = await productionNextDayInsight({ lookbackDays: 14 });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/insights/production/next-day?lookback_days=14",
    );
    expect(got.data).toEqual({
      target_date: "2026-07-14",
      lookback_days: 14,
      generated_at: "2026-07-13T10:00:00.000Z",
      items: [
        {
          menu_id: "menu-1",
          menu_title: "Nasi Goreng",
          current_stock: 5,
          avg_daily_sales: 8,
          projected_demand: 10,
          recommended_production_qty: 5,
          max_producible: 12,
          confidence: "high",
          limited_by_ingredients: false,
        },
        {
          menu_id: "menu-2",
          menu_title: "Mie Goreng",
          current_stock: 20,
          avg_daily_sales: 3,
          projected_demand: 4,
          recommended_production_qty: 3,
          max_producible: 3,
          confidence: "medium",
          limited_by_ingredients: true,
        },
      ],
    });
  });

  it("coerces missing numeric fields in production next-day insight items to finite numbers", async () => {
    const backendPayload = {
      target_date: "2026-07-14",
      lookback_days: 14,
      generated_at: "2026-07-13T10:00:00.000Z",
      menus: [
        {
          menu_id: "menu-1",
          menu_title: "Nasi Goreng",
          current_available_stock: 5,
          recommended_production_qty: 3,
          max_producible_from_ingredients: null,
          confidence: "high",
          is_limited_by_ingredients: false,
        },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: backendPayload }),
    );

    const got = await productionNextDayInsight({ lookbackDays: 14 });
    const item = got.data?.items[0];

    expect(item?.avg_daily_sales).toBe(0);
    expect(item?.projected_demand).toBe(0);
    expect(Number.isFinite(item?.current_stock)).toBe(true);
    expect(Number.isFinite(item?.avg_daily_sales)).toBe(true);
    expect(Number.isFinite(item?.projected_demand)).toBe(true);
    expect(Number.isFinite(item?.recommended_production_qty)).toBe(true);
    expect(item?.max_producible).toBeNull();
    expect(item?.limited_by_ingredients).toBe(false);
  });

  it("returns empty items when production next-day insight menus is missing", () => {
    const normalized = normalizeProductionNextDayInsight({
      target_date: "2026-07-14",
      lookback_days: 14,
      generated_at: "2026-07-13T00:00:00Z",
      menus: undefined as unknown as [],
    });

    expect(normalized.items).toEqual([]);
  });

  it("returns undefined data when production next-day insight response has no data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: null }),
    );

    const got = await productionNextDayInsight({ lookbackDays: 14 });

    expect(got.data).toBeUndefined();
  });
});
