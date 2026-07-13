import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getBranchAssetsSummary } from "./branch-assets";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("getBranchAssetsSummary", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds the correct summary URL and unwraps the response", async () => {
    const summary = {
      total_asset_value: 30_000_000,
      asset_count: 2,
      total_quantity: 5,
      profit_daily_avg: 100_000,
      profit_monthly_avg: 3_000_000,
      bep_days: 300,
      bep_months: 10,
      bep_message: null,
      bep_reachable: true,
      profit_source: "Based on net profit over the last 30 days",
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: summary }),
    );

    const got = await getBranchAssetsSummary({ profitLookbackDays: 30 });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/branch-assets/summary?profit_lookback_days=30",
    );
    expect(got.data).toEqual(summary);
  });

  it("omits query params when profitLookbackDays is not provided", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          total_asset_value: 0,
          asset_count: 0,
          total_quantity: 0,
          profit_daily_avg: 0,
          profit_monthly_avg: 0,
          bep_days: null,
          bep_months: null,
          bep_message: "No profit data available",
          bep_reachable: false,
          profit_source: "No sales history",
        },
      }),
    );

    await getBranchAssetsSummary();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8080/api/admin/branch-assets/summary");
  });
});
