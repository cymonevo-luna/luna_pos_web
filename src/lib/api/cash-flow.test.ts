import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cashFlowAdminApi } from "./cash-flow";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("cashFlowAdminApi", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds the correct summary URL and unwraps the response", async () => {
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
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: summary }),
    );

    const got = await cashFlowAdminApi.summary({
      period: "daily",
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/insights/cash-flow/summary?period=daily&date_from=2026-07-13T00%3A00%3A00.000Z&date_to=2026-07-13T23%3A59%3A59.999Z",
    );
    expect(got.data).toEqual(summary);
  });
});
