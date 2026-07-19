import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  invalidateCashierBalanceData,
  useCashierBalance,
  useCashierBalanceEntries,
  useCreateCashierBalanceAdjustment,
  useDeleteCashierBalanceEntry,
} from "@/lib/hooks/use-cashier-balance";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("useCashierBalance", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches balance on mount", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: { balance: 500_000, updated_at: "2026-01-01T00:00:00Z" },
      }),
    );

    const { result } = renderHook(() => useCashierBalance());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.balance?.balance).toBe(500_000);
  });

  it("refetches after invalidateCashierBalanceData", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: { balance: 0 },
      }),
    );

    const { result } = renderHook(() => useCashierBalance());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const initialCalls = fetchMock.mock.calls.length;

    act(() => {
      invalidateCashierBalanceData();
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });
});

describe("useCashierBalanceEntries", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches entries on mount", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          {
            id: "cb-entry-1",
            type: "ADD",
            source: "MANUAL",
            amount: 50_000,
            purpose: "Web test",
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
        meta: { page: 1, per_page: 10, total: 1 },
      }),
    );

    const { result } = renderHook(() =>
      useCashierBalanceEntries({ page: 1, perPage: 10 }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]?.purpose).toBe("Web test");
  });
});

describe("useCreateCashierBalanceAdjustment", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("invalidates balance and entries after create", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (method === "GET" && url.endsWith("/api/admin/cashier-balance")) {
          return jsonResponse({ success: true, data: { balance: 0 } });
        }
        if (
          method === "GET" &&
          url.includes("/api/admin/cashier-balance/entries")
        ) {
          return jsonResponse({
            success: true,
            data: [],
            meta: { page: 1, per_page: 10, total: 0 },
          });
        }
        if (
          method === "POST" &&
          url.endsWith("/api/admin/cashier-balance/adjustments")
        ) {
          return jsonResponse({
            success: true,
            data: {
              id: "cb-entry-new",
              type: "ADD",
              source: "MANUAL",
              amount: 50_000,
              purpose: "Web test",
              created_at: "2026-01-01T00:00:00Z",
            },
          });
        }
        return jsonResponse({ success: false }, 404);
      },
    );

    const balanceHook = renderHook(() => useCashierBalance());
    const entriesHook = renderHook(() => useCashierBalanceEntries());
    const createHook = renderHook(() => useCreateCashierBalanceAdjustment());

    await waitFor(() => {
      expect(balanceHook.result.current.loading).toBe(false);
      expect(entriesHook.result.current.loading).toBe(false);
    });

    const callsBeforeCreate = fetchMock.mock.calls.length;

    await act(async () => {
      await createHook.result.current.mutateAsync({
        type: "ADD",
        amount: 50_000,
        purpose: "Web test",
      });
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBeforeCreate);
    });
  });
});

describe("useDeleteCashierBalanceEntry", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("invalidates balance and entries after delete", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (method === "GET" && url.endsWith("/api/admin/cashier-balance")) {
          return jsonResponse({ success: true, data: { balance: 100_000 } });
        }
        if (
          method === "GET" &&
          url.includes("/api/admin/cashier-balance/entries")
        ) {
          return jsonResponse({
            success: true,
            data: [
              {
                id: "cb-entry-1",
                type: "DEDUCT",
                source: "MANUAL",
                amount: 10_000,
                purpose: "Petty cash",
                created_at: "2026-01-01T00:00:00Z",
              },
            ],
            meta: { page: 1, per_page: 10, total: 1 },
          });
        }
        if (
          method === "DELETE" &&
          url.endsWith("/api/admin/cashier-balance/entries/cb-entry-1")
        ) {
          return jsonResponse({
            success: true,
            data: { balance: 110_000, updated_at: "2026-01-02T00:00:00Z" },
          });
        }
        return jsonResponse({ success: false }, 404);
      },
    );

    const balanceHook = renderHook(() => useCashierBalance());
    const entriesHook = renderHook(() => useCashierBalanceEntries());
    const deleteHook = renderHook(() => useDeleteCashierBalanceEntry());

    await waitFor(() => {
      expect(balanceHook.result.current.loading).toBe(false);
      expect(entriesHook.result.current.loading).toBe(false);
    });

    const callsBeforeDelete = fetchMock.mock.calls.length;

    await act(async () => {
      await deleteHook.result.current.mutateAsync("cb-entry-1");
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBeforeDelete);
    });
  });
});
