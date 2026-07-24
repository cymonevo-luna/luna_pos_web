import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cashierBalanceAdminApi,
  cashierBalanceAdjustmentFormToPayload,
  createAdjustment,
  deleteEntry,
  getBalance,
  isCashierBalanceEntryDateEditable,
  isCashierBalanceEntryDeletable,
  listEntries,
  normalizeCashierBalance,
  normalizeCashierBalanceEntry,
  updateEntryRecordDate,
} from "./cashier-balance";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const balanceRaw = {
  balance: "500000",
  updated_at: "2026-01-01T00:00:00Z",
};

const entryRaw = {
  id: "cb-entry-1",
  type: "ADD" as const,
  source: "MANUAL" as const,
  amount: "50000",
  purpose: "Web test",
  transaction_id: null,
  requested_by_user_id: "user-1",
  requested_by_username: "manager",
  created_at: "2026-01-01T00:00:00Z",
};

describe("cashierBalanceAdminApi", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds the correct balance URL and attaches authorization", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ success: true, data: balanceRaw }));

    await getBalance();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8080/api/admin/cashier-balance");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
  });

  it("builds the correct entries list URL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: [entryRaw],
        meta: { page: 2, per_page: 10, total: 1 },
      }),
    );

    await listEntries({ page: 2, perPage: 10 });

    const [url] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/cashier-balance/entries?page=2&per_page=10",
    );
  });

  it("unwraps envelope responses for balance, entries, and adjustments", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (method === "GET" && url.endsWith("/api/admin/cashier-balance")) {
        return jsonResponse({ success: true, data: balanceRaw });
      }
      if (
        method === "GET" &&
        url.includes("/api/admin/cashier-balance/entries")
      ) {
        return jsonResponse({
          success: true,
          data: [entryRaw],
          meta: { page: 1, per_page: 10, total: 1 },
        });
      }
      if (
        method === "POST" &&
        url.endsWith("/api/admin/cashier-balance/adjustments")
      ) {
        return jsonResponse({ success: true, data: entryRaw });
      }
      if (
        method === "DELETE" &&
        url.endsWith("/api/admin/cashier-balance/entries/cb-entry-1")
      ) {
        return jsonResponse({ success: true, data: balanceRaw });
      }
      if (
        method === "PATCH" &&
        url.endsWith("/api/admin/cashier-balance/entries/cb-entry-1/record-date")
      ) {
        return jsonResponse({
          success: true,
          data: {
            ...entryRaw,
            created_at: "2025-12-28T12:30:00Z",
          },
        });
      }
      return jsonResponse({ success: false }, 404);
    });

    const balance = await getBalance();
    expect(balance.data.balance).toBe(500_000);

    const entries = await cashierBalanceAdminApi.listEntries();
    expect(entries.data[0]?.amount).toBe(50_000);

    const created = await createAdjustment({
      type: "ADD",
      amount: 50_000,
      purpose: "Web test",
    });
    expect(created.data.purpose).toBe("Web test");

    const deleted = await deleteEntry("cb-entry-1");
    expect(deleted.data.balance).toBe(500_000);

    const recordDate = new Date("2025-12-28T12:30:00Z");
    const updated = await updateEntryRecordDate("cb-entry-1", recordDate);
    expect(updated.data.created_at).toBe("2025-12-28T12:30:00Z");
  });

  it("builds the correct delete entry URL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: balanceRaw }),
    );

    await deleteEntry("cb-entry-99");

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/cashier-balance/entries/cb-entry-99",
    );
    expect(init?.method).toBe("DELETE");
  });

  it("patches record date with ISO8601 payload", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          ...entryRaw,
          created_at: "2025-12-28T12:30:00Z",
        },
      }),
    );

    const recordDate = new Date("2025-12-28T12:30:00Z");
    const result = await updateEntryRecordDate("cb-entry-1", recordDate);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/cashier-balance/entries/cb-entry-1/record-date",
    );
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({
      record_date: recordDate.toISOString(),
    });
    expect(result.data.created_at).toBe("2025-12-28T12:30:00Z");
  });
});

describe("normalizeCashierBalance", () => {
  it("coerces string balance to number", () => {
    expect(
      normalizeCashierBalance({
        balance: "250000",
        updated_at: "2026-01-01T00:00:00Z",
      }),
    ).toEqual({
      balance: 250_000,
      updated_at: "2026-01-01T00:00:00Z",
    });
  });
});

describe("normalizeCashierBalanceEntry", () => {
  it("coerces string amount to number", () => {
    expect(normalizeCashierBalanceEntry(entryRaw).amount).toBe(50_000);
  });
});

describe("isCashierBalanceEntryDeletable", () => {
  it("returns true for MANUAL and EXPENSE sources", () => {
    expect(isCashierBalanceEntryDeletable({ source: "MANUAL" })).toBe(true);
    expect(isCashierBalanceEntryDeletable({ source: "EXPENSE" })).toBe(true);
  });

  it("returns false for transaction-linked sources", () => {
    expect(isCashierBalanceEntryDeletable({ source: "CASH_PAYMENT" })).toBe(
      false,
    );
    expect(isCashierBalanceEntryDeletable({ source: "CASH_CHANGE" })).toBe(
      false,
    );
    expect(
      isCashierBalanceEntryDeletable({ source: "TRANSACTION_REVERSAL" }),
    ).toBe(false);
  });
});

describe("isCashierBalanceEntryDateEditable", () => {
  it("returns true when entry has no transaction or expense link", () => {
    expect(
      isCashierBalanceEntryDateEditable({
        transaction_id: null,
        expense_id: null,
      }),
    ).toBe(true);
  });

  it("returns false when entry is transaction-linked", () => {
    expect(
      isCashierBalanceEntryDateEditable({
        transaction_id: "txn-1",
        expense_id: null,
      }),
    ).toBe(false);
  });

  it("returns false when entry is expense-linked", () => {
    expect(
      isCashierBalanceEntryDateEditable({
        transaction_id: null,
        expense_id: "exp-1",
      }),
    ).toBe(false);
  });
});

describe("cashierBalanceAdjustmentFormToPayload", () => {
  it("maps form values to API payload", () => {
    expect(
      cashierBalanceAdjustmentFormToPayload({
        type: "DEDUCT",
        amount: 25_000,
        purpose: "  Petty cash  ",
      }),
    ).toEqual({
      type: "DEDUCT",
      amount: 25_000,
      purpose: "Petty cash",
    });
  });
});
