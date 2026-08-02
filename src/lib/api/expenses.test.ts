import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startOfDayWIB, todayWIB } from "@/lib/datetime/wib";
import {
  createExpense,
  deleteExpense,
  downloadExpenseImportTemplate,
  downloadExpenseImportTemplateFile,
  expenseFormToPayload,
  expenseToFormValues,
  expensesAdminApi,
  getExpense,
  importExpensesCsv,
  listExpenses,
  normalizeExpense,
  updateExpense,
  updateRecordDate,
  type CreateExpensePayload,
} from "./expenses";
import type { Expense } from "./types";
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
  source_of_fund: "PERSONAL_MONEY",
  receipt_url: "https://example.com/receipt.jpg",
  created_by_user_id: "user-1",
  created_by_username: "manager",
  transaction_date: "2026-07-01T10:00:00Z",
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

  it("builds list URL with transaction date range params", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse({
          success: true,
          data: [],
          meta: { page: 1, per_page: 10, total: 0 },
        }),
      );

    await listExpenses({
      page: 1,
      perPage: 10,
      dateFrom: "2026-01-10",
      dateTo: "2026-01-20",
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/expenses?page=1&per_page=10&date_from=2026-01-10&date_to=2026-01-20",
    );
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
          method === "PATCH" &&
          url.endsWith("/api/admin/expenses/exp-1/record-date")
        ) {
          return jsonResponse({
            success: true,
            data: {
              ...expenseRaw,
              created_at: "2025-12-28T00:00:00Z",
            },
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

    const got = await getExpense("exp-1");
    expect(got.data.amount).toBe(150_000);
    expect(got.data.created_by_username).toBe("manager");

    const created = await createExpense({
      title: "Office supplies",
      amount: 150_000,
      source_of_fund: "PERSONAL_MONEY",
      receipt_url: "https://example.com/receipt.jpg",
    });
    expect(created.data?.title).toBe("Office supplies");

    const updated = await updateExpense("exp-1", {
      title: "Office supplies",
      amount: 150_000,
      source_of_fund: "PERSONAL_MONEY",
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

  it("patches record date with ISO8601 payload", async () => {
    const originalCreatedAt = "2026-01-01T00:00:00Z";
    const updatedTransactionDate = "2025-12-28T12:30:00Z";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          ...expenseRaw,
          transaction_date: updatedTransactionDate,
          created_at: originalCreatedAt,
        },
      }),
    );

    const recordDate = new Date(updatedTransactionDate);
    const result = await updateRecordDate("exp-1", recordDate);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/expenses/exp-1/record-date",
    );
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({
      record_date: recordDate.toISOString(),
    });
    expect(result.data.transaction_date).toBe(updatedTransactionDate);
    expect(result.data.created_at).toBe(originalCreatedAt);
  });
});

describe("normalizeExpense", () => {
  it("coerces string amount to number", () => {
    const normalized = normalizeExpense({
      id: "exp-1",
      title: "Supplies",
      amount: "250000",
      transaction_date: "2026-07-01T10:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(normalized.amount).toBe(250_000);
  });
});

describe("expense transaction_date types", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts optional transaction_date on create payload", () => {
    const payload = {
      title: "Supplies",
      amount: 100_000,
      source_of_fund: "PERSONAL_MONEY",
      transaction_date: "2026-07-01T10:00:00Z",
    } satisfies CreateExpensePayload;

    expect(payload.transaction_date).toBe("2026-07-01T10:00:00Z");
  });

  it("exposes transaction_date on parsed expense response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: expenseRaw }),
    );

    const result = await getExpense("exp-1");
    const expense: Expense = result.data;
    expect(expense.transaction_date).toBe("2026-07-01T10:00:00Z");
  });

  it("passes transaction_date in create request body", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: expenseRaw }),
    );

    await createExpense({
      title: "Office supplies",
      amount: 150_000,
      source_of_fund: "PERSONAL_MONEY",
      transaction_date: "2026-07-01T10:00:00Z",
    });

    const postCall = fetchMock.mock.calls.find(
      ([, init]) => init?.method === "POST",
    );
    expect(postCall).toBeDefined();
    const [, init] = postCall!;
    expect(JSON.parse(String(init?.body))).toMatchObject({
      transaction_date: "2026-07-01T10:00:00Z",
    });
  });
});

describe("expenseFormToPayload", () => {
  it("maps form values without receipt on create", () => {
    expect(
      expenseFormToPayload({
        title: "  Office supplies  ",
        description: "Printer paper",
        amount: 150_000,
        source_of_fund: "PERSONAL_MONEY",
        receipt_url: "",
      }),
    ).toEqual({
      title: "Office supplies",
      description: "Printer paper",
      amount: 150_000,
      source_of_fund: "PERSONAL_MONEY",
    });
  });

  it("includes source_of_fund for cashier expenses", () => {
    expect(
      expenseFormToPayload({
        title: "Petty cash",
        description: "",
        amount: 50_000,
        source_of_fund: "CASHIER",
        receipt_url: "",
      }),
    ).toEqual({
      title: "Petty cash",
      amount: 50_000,
      source_of_fund: "CASHIER",
    });
  });

  it("includes receipt_url when present", () => {
    expect(
      expenseFormToPayload({
        title: "Office supplies",
        description: "",
        amount: 150_000,
        source_of_fund: "PERSONAL_MONEY",
        receipt_url: "https://cdn.example.com/receipt.jpg",
      }),
    ).toEqual({
      title: "Office supplies",
      amount: 150_000,
      source_of_fund: "PERSONAL_MONEY",
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
          source_of_fund: "PERSONAL_MONEY",
          receipt_url: "",
        },
        { includeEmptyReceipt: true },
      ),
    ).toEqual({
      title: "Office supplies",
      amount: 150_000,
      source_of_fund: "PERSONAL_MONEY",
      receipt_url: "",
    });
  });

  it("omits transaction_date when date is today", () => {
    expect(
      expenseFormToPayload(
        {
          title: "Office supplies",
          description: "",
          amount: 150_000,
          source_of_fund: "PERSONAL_MONEY",
          receipt_url: "",
          transactionDate: todayWIB(),
        },
        { includeTransactionDate: true },
      ),
    ).toEqual({
      title: "Office supplies",
      amount: 150_000,
      source_of_fund: "PERSONAL_MONEY",
    });
  });

  it("includes transaction_date for past dates as start of WIB day", () => {
    expect(
      expenseFormToPayload(
        {
          title: "Office supplies",
          description: "",
          amount: 150_000,
          source_of_fund: "PERSONAL_MONEY",
          receipt_url: "",
          transactionDate: "2026-07-20",
        },
        { includeTransactionDate: true },
      ),
    ).toEqual({
      title: "Office supplies",
      amount: 150_000,
      source_of_fund: "PERSONAL_MONEY",
      transaction_date: startOfDayWIB("2026-07-20").toISOString(),
    });
  });

  it("includes transaction_date for cashier expenses with past dates", () => {
    expect(
      expenseFormToPayload(
        {
          title: "Petty cash",
          description: "",
          amount: 50_000,
          source_of_fund: "CASHIER",
          receipt_url: "",
          transactionDate: "2026-07-20",
        },
        { includeTransactionDate: true },
      ),
    ).toEqual({
      title: "Petty cash",
      amount: 50_000,
      source_of_fund: "CASHIER",
      transaction_date: startOfDayWIB("2026-07-20").toISOString(),
    });
  });
});

describe("expenseToFormValues", () => {
  it("maps transaction_date to recordDate in form defaults", () => {
    expect(
      expenseToFormValues({
        id: "exp-1",
        title: "Utilities",
        description: null,
        amount: 250_000,
        source_of_fund: "CASHIER",
        receipt_url: "https://cdn.example.com/receipt.jpg",
        transaction_date: "2026-07-01T10:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      }),
    ).toEqual({
      title: "Utilities",
      description: "",
      amount: 250_000,
      source_of_fund: "CASHIER",
      receipt_url: "https://cdn.example.com/receipt.jpg",
      recordDate: new Date("2026-07-01T10:00:00Z"),
    });
  });

  it("defaults missing source_of_fund to Personal Money", () => {
    expect(
      expenseToFormValues({
        id: "exp-1",
        title: "Utilities",
        description: null,
        amount: 250_000,
        receipt_url: null,
        transaction_date: "2026-07-01T10:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      }),
    ).toEqual({
      title: "Utilities",
      description: "",
      amount: 250_000,
      source_of_fund: "PERSONAL_MONEY",
      receipt_url: "",
      recordDate: new Date("2026-07-01T10:00:00Z"),
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

describe("expense CSV import", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("downloads the import template with authorization", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        "title,amount,description,source_of_fund,receipt_url",
        {
          status: 200,
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition":
              'attachment; filename="expense-import-template.csv"',
          },
        },
      ),
    );

    const result = await downloadExpenseImportTemplate();

    expect(await result.blob.text()).toBe(
      "title,amount,description,source_of_fund,receipt_url",
    );
    expect(result.filename).toBe("expense-import-template.csv");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/expenses/import/template",
    );
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
  });

  it("posts multipart import payload and normalizes expense amounts", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const file = new File(["csv"], "import.csv", { type: "text/csv" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          imported_row_count: 2,
          expenses: [
            expenseRaw,
            { ...expenseRaw, id: "exp-2", amount: "75000" },
          ],
        },
      }),
    );

    const result = await importExpensesCsv({
      file,
      transactionDate: "2026-07-25",
    });

    expect(result.imported_row_count).toBe(2);
    expect(result.expenses?.[0]?.amount).toBe(150_000);
    expect(result.expenses?.[1]?.amount).toBe(75_000);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8080/api/admin/expenses/import");
    expect(init?.method).toBe("POST");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
    expect(headers.get("Content-Type")).toBeNull();

    const body = init?.body as FormData;
    expect(body.get("transaction_date")).toBe("2026-07-25");
    expect(body.get("file")).toBeInstanceOf(File);
  });

  it("throws ApiError with field errors on validation failure", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const file = new File(["csv"], "import.csv", { type: "text/csv" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: {
            code: "validation_error",
            message: "Import validation failed",
            fields: {
              "row_2.amount": "Amount must be positive",
            },
          },
        },
        422,
      ),
    );

    await expect(
      importExpensesCsv({ file, transactionDate: "2026-07-25" }),
    ).rejects.toMatchObject({
      status: 422,
      message: "Import validation failed",
      fields: {
        "row_2.amount": "Amount must be positive",
      },
    });
  });
});

describe("downloadExpenseImportTemplateFile", () => {
  it("creates a download link for the template blob", () => {
    const click = vi.fn();
    const anchor = {
      href: "",
      download: "",
      click,
    } as unknown as HTMLAnchorElement;

    vi.spyOn(document, "createElement").mockReturnValue(anchor);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL");

    downloadExpenseImportTemplateFile(
      new Blob(["title,amount,description,source_of_fund,receipt_url"]),
      { filename: "expense-import-template.csv" },
    );

    expect(anchor.download).toBe("expense-import-template.csv");
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("defaults to expense-import-template.csv filename", () => {
    const click = vi.fn();
    const anchor = {
      href: "",
      download: "",
      click,
    } as unknown as HTMLAnchorElement;

    vi.spyOn(document, "createElement").mockReturnValue(anchor);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");

    downloadExpenseImportTemplateFile(
      new Blob(["title,amount,description,source_of_fund,receipt_url"]),
    );

    expect(anchor.download).toBe("expense-import-template.csv");
  });
});
