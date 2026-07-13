import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { transactionsPosApi } from "./pos-transactions";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("transactionsPosApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds the correct list URL with page, per_page, and date filters", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse({
          success: true,
          data: [],
          meta: { page: 1, per_page: 5, total: 0 },
        }),
      );

    await transactionsPosApi.list({
      page: 1,
      perPage: 5,
      dateFrom: "2026-07-01",
      dateTo: "2026-07-12",
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/v1/pos/transactions?page=1&per_page=5&date_from=2026-07-01T00%3A00%3A00.000Z&date_to=2026-07-12T23%3A59%3A59.999Z",
    );
  });

  it("unwraps summary response buckets", async () => {
    const summary = {
      period: "daily",
      buckets: [
        {
          period_start: "2026-07-01T00:00:00Z",
          period_label: "2026-07-01",
          count: 4,
          total_amount: 200000,
        },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: summary }),
    );

    const got = await transactionsPosApi.summary({ period: "daily" });
    expect(got.data.buckets).toEqual(summary.buckets);
    expect(got.data.buckets[0].count).toBe(4);
    expect(got.data.buckets[0].total_amount).toBe(200000);
  });

  it("targets transaction by id and unwraps the response", async () => {
    const transaction = {
      id: "txn-id",
      method: "CASH",
      amount: 50000,
      cash_tendered: 100000,
      change_amount: 50000,
      cashier_user_id: "user-1",
      cashier_username: "kasir1",
      items: [
        {
          menu_id: "menu-1",
          title: "Nasi Goreng",
          quantity: 2,
          unit_price: 25000,
          line_total: 50000,
        },
      ],
      transaction_date: "2026-07-01T10:30:00Z",
      created_at: "2026-07-01T10:30:00Z",
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: transaction }),
    );

    const got = await transactionsPosApi.get("txn-id");
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8080/api/v1/pos/transactions/txn-id");
    expect(got.data).toEqual(transaction);
  });
});
