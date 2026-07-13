import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cashFlowSummary,
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

  it("builds the production next-day insight URL", async () => {
    const insight = {
      lookback_days: 14,
      generated_at: "2026-07-13T10:00:00.000Z",
      items: [],
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: insight }),
    );

    await productionNextDayInsight({ lookbackDays: 14 });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/insights/production/next-day?lookback_days=14",
    );
  });
});
