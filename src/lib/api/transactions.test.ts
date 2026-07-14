import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  transactionsAdminApi,
  dateInputToIso,
} from "./transactions";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("dateInputToIso", () => {
  it("serializes start of day for date_from", () => {
    expect(dateInputToIso("2026-03-15", false)).toBe(
      "2026-03-15T00:00:00.000Z",
    );
  });

  it("serializes end of day for date_to", () => {
    expect(dateInputToIso("2026-03-15", true)).toBe(
      "2026-03-15T23:59:59.999Z",
    );
  });
});

describe("transactionsAdminApi", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds the correct list URL with filters and attaches authorization", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse({
          success: true,
          data: [],
          meta: { page: +2, per_page: 10, total: 0 },
        }),
      );

    await transactionsAdminApi.list({
      page: 2,
      perPage: 10,
      method: "CASH",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      cashierUsername: "kasir1",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/transactions?page=2&per_page=10&method=CASH&date_from=2026-01-01T00%3A00%3A00.000Z&date_to=2026-01-31T23%3A59%3A59.999Z&cashier_username=kasir1",
    );
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
  });

  it("unwraps envelope responses for get", async () => {
    const transaction = {
      id: "txn-1",
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
      transaction_date: "2026-01-15T10:30:00Z",
      created_at: "2026-01-15T10:30:00Z",
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: transaction }),
    );

    const got = await transactionsAdminApi.get("txn-1");
    expect(got.data).toEqual(transaction);
  });

  it("builds the correct summary URL and unwraps the response", async () => {
    const summary = {
      period: "daily",
      buckets: [
        {
          period_start: "2026-01-01T00:00:00Z",
          period_label: "2026-01-01",
          count: 3,
          total_amount: 150000,
        },
      ],
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: summary }),
    );

    const got = await transactionsAdminApi.summary({
      period: "daily",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/transactions/summary?period=daily&date_from=2026-01-01T00%3A00%3A00.000Z&date_to=2026-01-31T23%3A59%3A59.999Z",
    );
    expect(got.data).toEqual(summary);
  });

  it("issues DELETE to /api/admin/transactions/{id}", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    await transactionsAdminApi.delete("txn-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8080/api/admin/transactions/txn-1");
    expect(init?.method).toBe("DELETE");
  });
});
