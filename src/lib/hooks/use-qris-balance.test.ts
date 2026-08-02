import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  invalidateQrisBalanceData,
  useQrisBalance,
  useQrisBalanceEntries,
  useCreateQrisBalanceAdjustment,
  useDeleteQrisBalanceEntry,
  useUpdateQrisBalanceEntryRecordDate,
} from "@/lib/hooks/use-qris-balance";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("useQrisBalance", () => {
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

    const { result } = renderHook(() => useQrisBalance());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.balance?.balance).toBe(500_000);
  });

  it("refetches after invalidateQrisBalanceData", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: { balance: 0 },
      }),
    );

    const { result } = renderHook(() => useQrisBalance());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const initialCalls = fetchMock.mock.calls.length;

    act(() => {
      invalidateQrisBalanceData();
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });
});

describe("useQrisBalanceEntries", () => {
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
            id: "qb-entry-1",
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
      useQrisBalanceEntries({ page: 1, perPage: 10 }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]?.purpose).toBe("Web test");
  });
});

describe("useCreateQrisBalanceAdjustment", () => {
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

        if (method === "GET" && url.endsWith("/api/admin/qris-balance")) {
          return jsonResponse({ success: true, data: { balance: 0 } });
        }
        if (
          method === "GET" &&
          url.includes("/api/admin/qris-balance/entries")
        ) {
          return jsonResponse({
            success: true,
            data: [],
            meta: { page: 1, per_page: 10, total: 0 },
          });
        }
        if (
          method === "POST" &&
          url.endsWith("/api/admin/qris-balance/adjustments")
        ) {
          return jsonResponse({
            success: true,
            data: {
              id: "qb-entry-new",
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

    const balanceHook = renderHook(() => useQrisBalance());
    const entriesHook = renderHook(() => useQrisBalanceEntries());
    const createHook = renderHook(() => useCreateQrisBalanceAdjustment());

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

describe("useDeleteQrisBalanceEntry", () => {
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

        if (method === "GET" && url.endsWith("/api/admin/qris-balance")) {
          return jsonResponse({ success: true, data: { balance: 100_000 } });
        }
        if (
          method === "GET" &&
          url.includes("/api/admin/qris-balance/entries")
        ) {
          return jsonResponse({
            success: true,
            data: [
              {
                id: "qb-entry-1",
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
          url.endsWith("/api/admin/qris-balance/entries/qb-entry-1")
        ) {
          return jsonResponse({
            success: true,
            data: { balance: 110_000, updated_at: "2026-01-02T00:00:00Z" },
          });
        }
        return jsonResponse({ success: false }, 404);
      },
    );

    const balanceHook = renderHook(() => useQrisBalance());
    const entriesHook = renderHook(() => useQrisBalanceEntries());
    const deleteHook = renderHook(() => useDeleteQrisBalanceEntry());

    await waitFor(() => {
      expect(balanceHook.result.current.loading).toBe(false);
      expect(entriesHook.result.current.loading).toBe(false);
    });

    const callsBeforeDelete = fetchMock.mock.calls.length;

    await act(async () => {
      await deleteHook.result.current.mutateAsync("qb-entry-1");
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBeforeDelete);
    });
  });
});

describe("useUpdateQrisBalanceEntryRecordDate", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("invalidates entries after record date update", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (method === "GET" && url.endsWith("/api/admin/qris-balance")) {
          return jsonResponse({ success: true, data: { balance: 100_000 } });
        }
        if (
          method === "GET" &&
          url.includes("/api/admin/qris-balance/entries")
        ) {
          return jsonResponse({
            success: true,
            data: [
              {
                id: "qb-entry-1",
                type: "ADD",
                source: "MANUAL",
                amount: 10_000,
                purpose: "Opening float",
                created_at: "2026-01-01T00:00:00Z",
              },
            ],
            meta: { page: 1, per_page: 10, total: 1 },
          });
        }
        if (
          method === "PATCH" &&
          url.endsWith(
            "/api/admin/qris-balance/entries/qb-entry-1/record-date",
          )
        ) {
          return jsonResponse({
            success: true,
            data: {
              id: "qb-entry-1",
              type: "ADD",
              source: "MANUAL",
              amount: 10_000,
              purpose: "Opening float",
              created_at: "2026-02-15T10:00:00Z",
            },
          });
        }
        return jsonResponse({ success: false }, 404);
      },
    );

    const entriesHook = renderHook(() => useQrisBalanceEntries());
    const updateHook = renderHook(() => useUpdateQrisBalanceEntryRecordDate());

    await waitFor(() => {
      expect(entriesHook.result.current.loading).toBe(false);
    });

    const callsBeforeUpdate = fetchMock.mock.calls.length;

    await act(async () => {
      await updateHook.result.current.mutateAsync(
        "qb-entry-1",
        new Date("2026-02-15T10:00:00Z"),
      );
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBeforeUpdate);
    });
  });
});
