import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  recurringExpensesAdminApi,
  recurringExpenseFormToPayload,
  formatRecurringScheduleSummary,
  listRecurringExpenses,
  normalizeRecurringExpense,
} from "./recurring-expenses";
import { recurringExpenseSchema } from "@/lib/validations";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const baseFormValues = {
  title: "Rent",
  amount: 5_000_000,
  is_active: true,
  recurring: {
    interval: "DAY" as const,
    value: 1,
    time: { hour: 9, minute: 0, second: 0 },
  },
};

describe("recurringExpenseSchema", () => {
  it("accepts a valid DAY schedule", () => {
    const result = recurringExpenseSchema.safeParse(baseFormValues);
    expect(result.success).toBe(true);
  });

  it("accepts a valid DAILY schedule without value", () => {
    const result = recurringExpenseSchema.safeParse({
      ...baseFormValues,
      recurring: {
        interval: "DAILY",
        time: { hour: 8, minute: 30, second: 0 },
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid DATE schedule", () => {
    const result = recurringExpenseSchema.safeParse({
      ...baseFormValues,
      recurring: {
        interval: "DATE",
        value: 15,
        time: { hour: 10, minute: 0, second: 0 },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a title shorter than 2 characters", () => {
    const result = recurringExpenseSchema.safeParse({
      ...baseFormValues,
      title: "A",
    });
    expect(result.success).toBe(false);
  });

  it("rejects DAY schedule without weekday value", () => {
    const result = recurringExpenseSchema.safeParse({
      ...baseFormValues,
      recurring: {
        interval: "DAY",
        time: { hour: 9, minute: 0, second: 0 },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects DATE schedule with invalid day of month", () => {
    const result = recurringExpenseSchema.safeParse({
      ...baseFormValues,
      recurring: {
        interval: "DATE",
        value: 32,
        time: { hour: 9, minute: 0, second: 0 },
      },
    });
    expect(result.success).toBe(false);
  });
});

describe("recurringExpenseFormToPayload", () => {
  it("maps form values to API payload", () => {
    const payload = recurringExpenseFormToPayload({
      title: "  Rent  ",
      description: "Monthly rent",
      amount: 5_000_000,
      is_active: true,
      recurring: {
        interval: "DAY",
        value: 1,
        time: { hour: 9, minute: 0, second: 0 },
      },
    });

    expect(payload).toEqual({
      title: "Rent",
      description: "Monthly rent",
      amount: 5_000_000,
      is_active: true,
      recurring: {
        interval: "DAY",
        value: 1,
        time: { hour: 9, minute: 0, second: 0 },
      },
    });
  });

  it("omits value for DAILY interval", () => {
    const payload = recurringExpenseFormToPayload({
      title: "Utilities",
      description: "",
      amount: 50_000,
      is_active: true,
      recurring: {
        interval: "DAILY",
        time: { hour: 8, minute: 30, second: 0 },
      },
    });

    expect(payload.recurring).toEqual({
      interval: "DAILY",
      time: { hour: 8, minute: 30, second: 0 },
    });
    expect(payload.recurring).not.toHaveProperty("value");
  });
});

describe("formatRecurringScheduleSummary", () => {
  it("formats weekly schedule", () => {
    expect(
      formatRecurringScheduleSummary({
        interval: "DAY",
        value: 1,
        time: { hour: 8, minute: 30, second: 0 },
      }),
    ).toBe("Every Mon at 08:30:00");
  });

  it("formats daily schedule", () => {
    expect(
      formatRecurringScheduleSummary({
        interval: "DAILY",
        time: { hour: 9, minute: 0, second: 0 },
      }),
    ).toBe("Every day at 09:00:00");
  });
});

describe("recurringExpensesAdminApi", () => {
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

    await listRecurringExpenses({
      page: 2,
      perPage: 10,
      search: "rent",
      isActive: true,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/recurring-expenses?page=2&per_page=10&search=rent&is_active=true",
    );
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
  });

  it("unwraps envelope responses for get, create, update, and delete", async () => {
    const expense = {
      id: "re-1",
      title: "Rent",
      description: null,
      amount: "5000000",
      is_active: true,
      recurring: {
        interval: "DAY",
        value: 1,
        time: { hour: 9, minute: 0, second: 0 },
      },
      next_run_at: "2026-07-21T09:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (method === "GET" && url.endsWith("/api/admin/recurring-expenses/re-1")) {
        return jsonResponse({ success: true, data: expense });
      }
      if (method === "POST" && url.endsWith("/api/admin/recurring-expenses")) {
        return jsonResponse({ success: true, data: expense });
      }
      if (method === "PUT" && url.endsWith("/api/admin/recurring-expenses/re-1")) {
        return jsonResponse({ success: true, data: expense });
      }
      if (
        method === "DELETE" &&
        url.endsWith("/api/admin/recurring-expenses/re-1")
      ) {
        return new Response(null, { status: 204 });
      }
      return jsonResponse({ success: false }, 404);
    });

    const got = await recurringExpensesAdminApi.get("re-1");
    expect(got.data.amount).toBe(5_000_000);

    const created = await recurringExpensesAdminApi.create({
      title: "Rent",
      amount: 5_000_000,
      is_active: true,
      recurring: {
        interval: "DAY",
        value: 1,
        time: { hour: 9, minute: 0, second: 0 },
      },
    });
    expect(created.data?.title).toBe("Rent");

    const updated = await recurringExpensesAdminApi.update("re-1", {
      title: "Rent",
      amount: 5_000_000,
      is_active: true,
      recurring: {
        interval: "DAY",
        value: 1,
        time: { hour: 9, minute: 0, second: 0 },
      },
    });
    expect(updated.data?.title).toBe("Rent");

    await recurringExpensesAdminApi.delete("re-1");
  });

  it("normalizes string amount from list API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          {
            id: "re-1",
            title: "Rent",
            description: null,
            amount: "50000",
            is_active: true,
            recurring: {
              interval: "DAILY",
              time: { hour: 9, minute: 0, second: 0 },
            },
            next_run_at: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        meta: { page: 1, per_page: 10, total: 1 },
      }),
    );

    const result = await recurringExpensesAdminApi.list();
    expect(result.data[0]?.amount).toBe(50_000);
  });
});

describe("normalizeRecurringExpense", () => {
  it("coerces string amount to number", () => {
    const normalized = normalizeRecurringExpense({
      id: "re-1",
      title: "Rent",
      amount: "50000",
      is_active: true,
      recurring: {
        interval: "DAILY",
        time: { hour: 9, minute: 0, second: 0 },
      },
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(normalized.amount).toBe(50_000);
  });
});
