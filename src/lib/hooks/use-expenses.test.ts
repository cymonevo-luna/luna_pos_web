import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  invalidateExpenseLists,
  useCreateExpense,
  useDeleteExpense,
  useExpenses,
  useUploadExpenseReceipt,
} from "@/lib/hooks/use-expenses";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("useExpenses", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches expenses on mount", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          {
            id: "exp-1",
            title: "Supplies",
            amount: 100_000,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        meta: { page: 1, per_page: 10, total: 1 },
      }),
    );

    const { result } = renderHook(() => useExpenses({ page: 1, perPage: 10 }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.expenses).toHaveLength(1);
    expect(result.current.expenses[0]?.title).toBe("Supplies");
    expect(result.current.meta?.total).toBe(1);
  });

  it("refetches after invalidateExpenseLists", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: [],
        meta: { page: 1, per_page: 10, total: 0 },
      }),
    );

    const { result } = renderHook(() => useExpenses());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const initialCalls = fetchMock.mock.calls.length;

    act(() => {
      invalidateExpenseLists();
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });
});

describe("useCreateExpense", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("invalidates expense lists after create", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (method === "GET" && url.includes("/api/admin/expenses?")) {
          return jsonResponse({
            success: true,
            data: [],
            meta: { page: 1, per_page: 10, total: 0 },
          });
        }
        if (method === "POST" && url.endsWith("/api/admin/expenses")) {
          return jsonResponse({
            success: true,
            data: {
              id: "exp-new",
              title: "New expense",
              amount: 50_000,
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
          });
        }
        return jsonResponse({ success: false }, 404);
      },
    );

    const listHook = renderHook(() => useExpenses());
    const createHook = renderHook(() => useCreateExpense());

    await waitFor(() => {
      expect(listHook.result.current.loading).toBe(false);
    });

    const listCallsBeforeCreate = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/api/admin/expenses?"),
    ).length;

    await act(async () => {
      await createHook.result.current.mutateAsync({
        title: "New expense",
        amount: 50_000,
        source_of_fund: "PERSONAL_MONEY",
      });
    });

    await waitFor(() => {
      const listCallsAfterCreate = fetchMock.mock.calls.filter(([url]) =>
        String(url).includes("/api/admin/expenses?"),
      ).length;
      expect(listCallsAfterCreate).toBeGreaterThan(listCallsBeforeCreate);
    });
  });
});

describe("useDeleteExpense", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("invalidates expense lists after delete", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (method === "GET" && url.includes("/api/admin/expenses?")) {
          return jsonResponse({
            success: true,
            data: [],
            meta: { page: 1, per_page: 10, total: 0 },
          });
        }
        if (
          method === "DELETE" &&
          url.endsWith("/api/admin/expenses/exp-1")
        ) {
          return new Response(null, { status: 204 });
        }
        return jsonResponse({ success: false }, 404);
      },
    );

    const listHook = renderHook(() => useExpenses());
    const deleteHook = renderHook(() => useDeleteExpense());

    await waitFor(() => {
      expect(listHook.result.current.loading).toBe(false);
    });

    const listCallsBeforeDelete = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/api/admin/expenses?"),
    ).length;

    await act(async () => {
      await deleteHook.result.current.mutateAsync("exp-1");
    });

    await waitFor(() => {
      const listCallsAfterDelete = fetchMock.mock.calls.filter(([url]) =>
        String(url).includes("/api/admin/expenses?"),
      ).length;
      expect(listCallsAfterDelete).toBeGreaterThan(listCallsBeforeDelete);
    });
  });
});

describe("useUploadExpenseReceipt", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads receipt via multipart endpoint", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "receipt.jpg", {
      type: "image/jpeg",
    });

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          success: true,
          data: {
            url: "https://example.com/receipt.jpg",
            filename: "receipt.jpg",
            size_bytes: 3,
          },
        },
        201,
      ),
    );

    const { result } = renderHook(() => useUploadExpenseReceipt());

    let uploadResult: { url: string } | undefined;
    await act(async () => {
      uploadResult = await result.current.mutateAsync(file);
    });

    const uploadCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/api/admin/uploads/expense-receipt"),
    );
    expect(uploadCall).toBeDefined();
    expect(uploadCall?.[1]?.body).toBeInstanceOf(FormData);
    expect((uploadCall?.[1]?.body as FormData).get("file")).toBe(file);
    expect(uploadResult?.url).toBe("https://example.com/receipt.jpg");
  });
});
