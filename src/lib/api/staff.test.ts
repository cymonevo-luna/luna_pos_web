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
  };

  it("accepts valid staff form values", () => {
    const result = staffSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("rejects invalid NIK", () => {
    const result = staffSchema.safeParse({
      name: "Test",
      nik: "123",
      address: "Addr",
      job_title: "Role",
      salary_amount: 1000,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.includes("nik")),
      ).toBe(true);
    }
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
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.salary_amount).toBeUndefined();
    }
  });
});

describe("staffFormToPayload", () => {
  const base = {
    name: "Budi Santoso",
    nik: "3201010101010001",
    address: "Jl. Merdeka No. 10",
    job_title: "Cashier",
    salary_amount: 5000000,
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
      ktp_photo_url: "https://example.com/ktp.jpg",
      benefits: "BPJS, meal allowance",
    });
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

  it("maps undefined salary to zero", () => {
    expect(
      staffFormToPayload({
        ...base,
        salary_amount: undefined,
      }),
    ).toMatchObject({
      salary_amount: 0,
    });
  });

  it("maps NaN salary to zero", () => {
    expect(
      staffFormToPayload({
        ...base,
        salary_amount: Number.NaN,
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
