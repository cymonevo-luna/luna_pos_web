import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createExpense,
  deleteExpense,
  expenseFormToPayload,
  expenseToFormValues,
  expensesAdminApi,
  getExpense,
  listExpenses,
  normalizeExpense,
  updateExpense,
} from "./expenses";
import { uploadExpenseReceipt } from "./uploads";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const expenseRaw = {
  id: "exp-1",
  title: "Office supplies",
  description: "Printer paper",
  amount: "150000",
  receipt_url: "https://example.com/receipt.jpg",
  created_by_user_id: "user-1",
  created_by_username: "manager",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("expensesAdminApi", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds the correct list URL and attaches authorization", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse({
          success: true,
          data: [],
          meta: { page: 2, per_page: 10, total: 0 },
        }),
      );

    await listExpenses({
      page: 2,
      perPage: 10,
      search: "office",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/expenses?page=2&per_page=10&search=office",
    );
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
  });

  it("unwraps envelope responses for get, create, update, and delete", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (method === "GET" && url.endsWith("/api/admin/expenses/exp-1")) {
          return jsonResponse({ success: true, data: expenseRaw });
        }
        if (method === "POST" && url.endsWith("/api/admin/expenses")) {
          return jsonResponse({ success: true, data: expenseRaw });
        }
        if (method === "PUT" && url.endsWith("/api/admin/expenses/exp-1")) {
          return jsonResponse({ success: true, data: expenseRaw });
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

    const got = await getExpense("exp-1");
    expect(got.data.amount).toBe(150_000);
    expect(got.data.created_by_username).toBe("manager");

    const created = await createExpense({
      title: "Office supplies",
      amount: 150_000,
      receipt_url: "https://example.com/receipt.jpg",
    });
    expect(created.data?.title).toBe("Office supplies");

    const updated = await updateExpense("exp-1", {
      title: "Office supplies",
      amount: 150_000,
    });
    expect(updated.data?.title).toBe("Office supplies");

    await deleteExpense("exp-1");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("normalizes string amount fields from list API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: [expenseRaw],
        meta: { page: 1, per_page: 10, total: 1 },
      }),
    );

    const result = await expensesAdminApi.list();
    expect(result.data[0]?.amount).toBe(150_000);
  });
});

describe("normalizeExpense", () => {
  it("coerces string amount to number", () => {
    const normalized = normalizeExpense({
      id: "exp-1",
      title: "Supplies",
      amount: "250000",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(normalized.amount).toBe(250_000);
  });
});

describe("expenseFormToPayload", () => {
  it("maps form values without receipt on create", () => {
    expect(
      expenseFormToPayload({
        title: "  Office supplies  ",
        description: "Printer paper",
        amount: 150_000,
        receipt_url: "",
      }),
    ).toEqual({
      title: "Office supplies",
      description: "Printer paper",
      amount: 150_000,
    });
  });

  it("includes receipt_url when present", () => {
    expect(
      expenseFormToPayload({
        title: "Office supplies",
        description: "",
        amount: 150_000,
        receipt_url: "https://cdn.example.com/receipt.jpg",
      }),
    ).toEqual({
      title: "Office supplies",
      amount: 150_000,
      receipt_url: "https://cdn.example.com/receipt.jpg",
    });
  });

  it("sends empty receipt_url when clearing on edit", () => {
    expect(
      expenseFormToPayload(
        {
          title: "Office supplies",
          description: "",
          amount: 150_000,
          receipt_url: "",
        },
        { includeEmptyReceipt: true },
      ),
    ).toEqual({
      title: "Office supplies",
      amount: 150_000,
      receipt_url: "",
    });
  });
});

describe("expenseToFormValues", () => {
  it("maps expense fields to form defaults", () => {
    expect(
      expenseToFormValues({
        id: "exp-1",
        title: "Utilities",
        description: null,
        amount: 250_000,
        receipt_url: "https://cdn.example.com/receipt.jpg",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      }),
    ).toEqual({
      title: "Utilities",
      description: "",
      amount: 250_000,
      receipt_url: "https://cdn.example.com/receipt.jpg",
    });
  });
});

describe("uploadExpenseReceipt", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts multipart form data with field name file", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "receipt.jpg", {
      type: "image/jpeg",
    });

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          success: true,
          data: {
            url: "https://example.com/uploads/receipt.jpg",
            filename: "receipt.jpg",
            size_bytes: 3,
          },
        },
        201,
      ),
    );

    const result = await uploadExpenseReceipt(file);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/uploads/expense-receipt",
    );
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get("file")).toBe(file);
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
    expect(headers.get("Content-Type")).toBeNull();
    expect(result.url).toBe("https://example.com/uploads/receipt.jpg");
    expect(result.filename).toBe("receipt.jpg");
    expect(result.size_bytes).toBe(3);
  });
});
