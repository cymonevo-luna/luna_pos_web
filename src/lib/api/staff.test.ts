import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  staffAdminApi,
  normalizeStaff,
  staffFormToPayload,
} from "./staff";
import { staffSchema } from "@/lib/validations";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("staffSchema", () => {
  const base = {
    name: "Budi Santoso",
    nik: "3201010101010001",
    address: "Jl. Merdeka No. 10",
    job_title: "Cashier",
    salary_amount: 5000000,
    join_date: "2026-06-01",
    payout_day_of_month: 26,
    bank_name: "",
    bank_account_holder_name: "",
    bank_account_number: "",
  };

  it("accepts valid staff form values", () => {
    const result = staffSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("accepts staff without nik, address, or banking", () => {
    const result = staffSchema.safeParse({
      name: "Budi Santoso",
      nik: "",
      address: "",
      job_title: "Cashier",
      salary_amount: 5000000,
      join_date: "2026-06-01",
      payout_day_of_month: 26,
      bank_name: "",
      bank_account_holder_name: "",
      bank_account_number: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid NIK when provided", () => {
    const result = staffSchema.safeParse({
      name: "Test",
      nik: "123",
      address: "",
      job_title: "Role",
      salary_amount: 1000,
      join_date: "2026-06-01",
      payout_day_of_month: 26,
      bank_name: "",
      bank_account_holder_name: "",
      bank_account_number: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.includes("nik")),
      ).toBe(true);
    }
  });

  it("rejects bank name without account number", () => {
    const result = staffSchema.safeParse({
      ...base,
      bank_name: "BCA",
      bank_account_number: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.path.includes("bank_account_number"),
        ),
      ).toBe(true);
    }
  });

  it("accepts bank name and account number without holder name", () => {
    const result = staffSchema.safeParse({
      ...base,
      bank_name: "BCA",
      bank_account_holder_name: "",
      bank_account_number: "1234567890",
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative salary", () => {
    const result = staffSchema.safeParse({
      ...base,
      salary_amount: -1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.path.includes("salary_amount"),
        ),
      ).toBe(true);
    }
  });

  it("accepts undefined salary", () => {
    const result = staffSchema.safeParse({
      ...base,
      salary_amount: undefined,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.salary_amount).toBeUndefined();
    }
  });

  it("accepts NaN salary as undefined", () => {
    const result = staffSchema.safeParse({
      ...base,
      salary_amount: Number.NaN,
      join_date: "",
      payout_day_of_month: undefined,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.salary_amount).toBeUndefined();
    }
  });

  it("requires join date and payout day when salary is set", () => {
    const result = staffSchema.safeParse({
      ...base,
      join_date: "",
      payout_day_of_month: undefined,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.includes("join_date")),
      ).toBe(true);
      expect(
        result.error.issues.some((issue) =>
          issue.path.includes("payout_day_of_month"),
        ),
      ).toBe(true);
    }
  });

  it("rejects payout day outside 1–31 when salary is set", () => {
    const result = staffSchema.safeParse({
      ...base,
      payout_day_of_month: 32,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.path.includes("payout_day_of_month"),
        ),
      ).toBe(true);
    }
  });

  it("does not require schedule fields when salary is unset", () => {
    const result = staffSchema.safeParse({
      ...base,
      salary_amount: undefined,
      join_date: "",
      payout_day_of_month: undefined,
    });
    expect(result.success).toBe(true);
  });
});

describe("staffFormToPayload", () => {
  const base = {
    name: "Budi Santoso",
    nik: "3201010101010001",
    address: "Jl. Merdeka No. 10",
    job_title: "Cashier",
    salary_amount: 5000000,
    join_date: "2026-06-01",
    payout_day_of_month: 26,
    bank_name: "",
    bank_account_holder_name: "",
    bank_account_number: "",
  };

  it("maps valid values to backend CreateInput shape", () => {
    expect(
      staffFormToPayload({
        ...base,
        ktp_photo_url: "https://example.com/ktp.jpg",
        benefits: "BPJS, meal allowance",
      }),
    ).toEqual({
      name: "Budi Santoso",
      nik: "3201010101010001",
      address: "Jl. Merdeka No. 10",
      job_title: "Cashier",
      salary_amount: 5000000,
      join_date: "2026-06-01",
      payout_day_of_month: 26,
      ktp_photo_url: "https://example.com/ktp.jpg",
      benefits: "BPJS, meal allowance",
    });
  });

  it("maps banking fields when provided", () => {
    expect(
      staffFormToPayload({
        ...base,
        bank_name: "BCA",
        bank_account_holder_name: "Budi Santoso",
        bank_account_number: "1234567890",
      }),
    ).toEqual({
      name: "Budi Santoso",
      nik: "3201010101010001",
      address: "Jl. Merdeka No. 10",
      job_title: "Cashier",
      salary_amount: 5000000,
      join_date: "2026-06-01",
      payout_day_of_month: 26,
      bank_name: "BCA",
      bank_account_holder_name: "Budi Santoso",
      bank_account_number: "1234567890",
    });
  });

  it("omits banking fields when empty", () => {
    const payload = staffFormToPayload({
      ...base,
      bank_name: "",
      bank_account_holder_name: "",
      bank_account_number: "",
    });
    expect(payload.bank_name).toBeUndefined();
    expect(payload.bank_account_holder_name).toBeUndefined();
    expect(payload.bank_account_number).toBeUndefined();
  });

  it("omits holder name when only bank name and number are provided", () => {
    const payload = staffFormToPayload({
      ...base,
      bank_name: "BCA",
      bank_account_holder_name: "",
      bank_account_number: "1234567890",
    });
    expect(payload).toMatchObject({
      bank_name: "BCA",
      bank_account_number: "1234567890",
    });
    expect(payload.bank_account_holder_name).toBeUndefined();
  });

  it("omits optional nik and address when empty", () => {
    const payload = staffFormToPayload({
      ...base,
      nik: "",
      address: "",
    });
    expect(payload.nik).toBeUndefined();
    expect(payload.address).toBeUndefined();
  });

  it("omits optional ktp_photo_url and benefits when empty", () => {
    const payload = staffFormToPayload({
      ...base,
      ktp_photo_url: "",
      benefits: "",
    });
    expect(payload).toEqual({
      name: "Budi Santoso",
      nik: "3201010101010001",
      address: "Jl. Merdeka No. 10",
      job_title: "Cashier",
      salary_amount: 5000000,
      join_date: "2026-06-01",
      payout_day_of_month: 26,
    });
    expect(payload.ktp_photo_url).toBeUndefined();
    expect(payload.benefits).toBeUndefined();
  });

  it("trims name and nik", () => {
    expect(
      staffFormToPayload({
        ...base,
        name: "  Budi Santoso  ",
        nik: "  3201010101010001  ",
      }),
    ).toMatchObject({
      name: "Budi Santoso",
      nik: "3201010101010001",
    });
  });

  it("maps undefined salary to zero without schedule fields", () => {
    expect(
      staffFormToPayload({
        ...base,
        salary_amount: undefined,
        join_date: "",
        payout_day_of_month: undefined,
      }),
    ).toMatchObject({
      salary_amount: 0,
    });
    expect(
      staffFormToPayload({
        ...base,
        salary_amount: undefined,
        join_date: "",
        payout_day_of_month: undefined,
      }).join_date,
    ).toBeUndefined();
    expect(
      staffFormToPayload({
        ...base,
        salary_amount: undefined,
        join_date: "",
        payout_day_of_month: undefined,
      }).payout_day_of_month,
    ).toBeUndefined();
  });

  it("includes schedule fields when salary is at least 1", () => {
    const payload = staffFormToPayload({
      ...base,
      salary_amount: 1,
      join_date: "2026-06-01",
      payout_day_of_month: 15,
    });
    expect(payload).toMatchObject({
      salary_amount: 1,
      join_date: "2026-06-01",
      payout_day_of_month: 15,
    });
  });

  it("maps NaN salary to zero", () => {
    expect(
      staffFormToPayload({
        ...base,
        salary_amount: Number.NaN,
        join_date: "",
        payout_day_of_month: undefined,
      }),
    ).toMatchObject({
      salary_amount: 0,
    });
  });
});

describe("normalizeStaff", () => {
  it("coerces string salary_amount to a number", () => {
    const normalized = normalizeStaff({
      id: "staff-1",
      name: "Budi Santoso",
      nik: "3201010101010001",
      address: "Jl. Merdeka No. 10",
      job_title: "Cashier",
      salary_amount: "5000000",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(normalized.salary_amount).toBe(5000000);
  });

  it("passes through recurring_expense_id", () => {
    const normalized = normalizeStaff({
      id: "staff-1",
      name: "Budi Santoso",
      nik: "3201010101010001",
      address: "Jl. Merdeka No. 10",
      job_title: "Cashier",
      salary_amount: 5000000,
      recurring_expense_id: "recurring-expense-1",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(normalized.recurring_expense_id).toBe("recurring-expense-1");
  });

  it("passes through join_date and payout_day_of_month", () => {
    const normalized = normalizeStaff({
      id: "staff-1",
      name: "Budi Santoso",
      nik: "3201010101010001",
      address: "Jl. Merdeka No. 10",
      job_title: "Cashier",
      salary_amount: 5000000,
      join_date: "2026-06-01",
      payout_day_of_month: 26,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(normalized.join_date).toBe("2026-06-01");
    expect(normalized.payout_day_of_month).toBe(26);
  });

  it("normalizes missing recurring_expense_id to null", () => {
    const normalized = normalizeStaff({
      id: "staff-1",
      name: "Budi Santoso",
      nik: "3201010101010001",
      address: "Jl. Merdeka No. 10",
      job_title: "Cashier",
      salary_amount: 5000000,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(normalized.recurring_expense_id).toBeNull();
  });
});

describe("staffAdminApi", () => {
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
          meta: { page: 2, per_page: 5, total: 0 },
        }),
      );

    await staffAdminApi.list({
      page: 2,
      perPage: 5,
      search: "budi",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/staff?page=2&per_page=5&search=budi",
    );
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
  });

  it("unwraps envelope responses for staff CRUD endpoints", async () => {
    const staff = {
      id: "staff-1",
      name: "Budi Santoso",
      nik: "3201010101010001",
      ktp_photo_url: "https://example.com/ktp.jpg",
      address: "Jl. Merdeka No. 10",
      job_title: "Cashier",
      salary_amount: 5000000,
      benefits: "BPJS",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (method === "GET" && url.endsWith("/api/admin/staff/staff-1")) {
          return jsonResponse({ success: true, data: staff });
        }
        if (method === "POST" && url.endsWith("/api/admin/staff")) {
          return jsonResponse({ success: true, data: staff });
        }
        if (method === "PUT" && url.endsWith("/api/admin/staff/staff-1")) {
          return jsonResponse({ success: true, data: staff });
        }
        if (method === "DELETE" && url.endsWith("/api/admin/staff/staff-1")) {
          return new Response(null, { status: 204 });
        }
        return jsonResponse({ success: false }, 404);
      },
    );

    const got = await staffAdminApi.get("staff-1");
    expect(got.data.salary_amount).toBe(5000000);

    const created = await staffAdminApi.create({
      name: "Budi Santoso",
      nik: "3201010101010001",
      address: "Jl. Merdeka No. 10",
      job_title: "Cashier",
      salary_amount: 5000000,
    });
    expect(created.data).toMatchObject({ id: "staff-1" });

    const updated = await staffAdminApi.update("staff-1", {
      name: "Budi Santoso",
      nik: "3201010101010001",
      address: "Jl. Merdeka No. 10",
      job_title: "Cashier",
      salary_amount: 5500000,
    });
    expect(updated.data).toMatchObject({ id: "staff-1" });

    await staffAdminApi.delete("staff-1");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("normalizes string salary_amount from list API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          {
            id: "staff-1",
            name: "Budi Santoso",
            nik: "3201010101010001",
            address: "Jl. Merdeka No. 10",
            job_title: "Cashier",
            salary_amount: "5000000",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-15T00:00:00Z",
          },
        ],
        meta: { page: 1, per_page: 10, total: 1 },
      }),
    );

    const result = await staffAdminApi.list();
    expect(result.data[0]?.salary_amount).toBe(5000000);
  });
});
