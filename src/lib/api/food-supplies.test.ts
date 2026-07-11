import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  foodSuppliesAdminApi,
  parseStockQuantity,
  normalizeFoodSupply,
} from "./food-supplies";
import { foodSupplySchema } from "@/lib/validations";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("foodSupplySchema", () => {
  const base = {
    title: "Olive oil",
    stock_quantity: 1.5,
  };

  it.each(["ml", "piece", "gr"] as const)(
    "accepts a valid payload with unit %s",
    (unit) => {
      const result = foodSupplySchema.safeParse({ ...base, unit });
      expect(result.success).toBe(true);
    },
  );

  it("accepts an optional description and empty string", () => {
    expect(
      foodSupplySchema.safeParse({
        ...base,
        unit: "ml",
        description: "Extra virgin",
      }).success,
    ).toBe(true);
    expect(
      foodSupplySchema.safeParse({ ...base, unit: "ml", description: "" })
        .success,
    ).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = foodSupplySchema.safeParse({
      title: "",
      stock_quantity: 1,
      unit: "ml",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
      expect(result.error.issues[0]?.message).toBeTruthy();
    }
  });

  it("rejects a title longer than 200 characters", () => {
    const result = foodSupplySchema.safeParse({
      title: "a".repeat(201),
      stock_quantity: 1,
      unit: "ml",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.length > 0)).toBe(true);
    }
  });

  it("rejects negative stock_quantity", () => {
    const result = foodSupplySchema.safeParse({
      title: "Salt",
      stock_quantity: -1,
      unit: "gr",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.message.includes("cannot be negative"),
        ),
      ).toBe(true);
    }
  });

  it("rejects an invalid unit", () => {
    const result = foodSupplySchema.safeParse({
      title: "Flour",
      stock_quantity: 2,
      unit: "kg",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
      expect(result.error.issues[0]?.message).toBeTruthy();
    }
  });
});

describe("foodSuppliesAdminApi", () => {
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

    await foodSuppliesAdminApi.list({
      page: 2,
      perPage: 10,
      search: "oil",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/food-supplies?page=2&per_page=10&search=oil",
    );
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
  });

  it("unwraps envelope responses for get, create, update, and delete", async () => {
    const supply = {
      id: "fs-1",
      title: "Olive oil",
      description: null,
      stock_quantity: 2.5,
      unit: "ml" as const,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (method === "GET" && url.endsWith("/api/admin/food-supplies/fs-1")) {
          return jsonResponse({ success: true, data: supply });
        }
        if (method === "POST" && url.endsWith("/api/admin/food-supplies")) {
          return jsonResponse({ success: true, data: supply });
        }
        if (method === "PUT" && url.endsWith("/api/admin/food-supplies/fs-1")) {
          return jsonResponse({ success: true, data: supply });
        }
        if (
          method === "DELETE" &&
          url.endsWith("/api/admin/food-supplies/fs-1")
        ) {
          return new Response(null, { status: 204 });
        }
        return jsonResponse({ success: false }, 404);
      },
    );

    const got = await foodSuppliesAdminApi.get("fs-1");
    expect(got.data).toEqual(supply);

    const created = await foodSuppliesAdminApi.create({
      title: "Olive oil",
      stock_quantity: 2.5,
      unit: "ml",
    });
    expect(created.data).toEqual(supply);

    const updated = await foodSuppliesAdminApi.update("fs-1", {
      title: "Olive oil",
      stock_quantity: 2.5,
      unit: "ml",
    });
    expect(updated.data).toEqual(supply);

    await foodSuppliesAdminApi.delete("fs-1");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("normalizes string stock_quantity from list API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          {
            id: "fs-1",
            title: "Milk",
            description: null,
            stock_quantity: "500",
            unit: "ml",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        meta: { page: 1, per_page: 10, total: 1 },
      }),
    );

    const result = await foodSuppliesAdminApi.list();
    expect(result.data[0]?.stock_quantity).toBe(500);
    expect(typeof result.data[0]?.stock_quantity).toBe("number");
  });

  it("normalizes decimal string stock_quantity from create API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          success: true,
          data: {
            id: "fs-2",
            title: "Spice mix",
            description: null,
            stock_quantity: "2.5",
            unit: "gr",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        },
        201,
      ),
    );

    const result = await foodSuppliesAdminApi.create({
      title: "Spice mix",
      stock_quantity: 2.5,
      unit: "gr",
    });
    expect(result.data?.stock_quantity).toBe(2.5);
    expect(typeof result.data?.stock_quantity).toBe("number");
  });
});

describe("parseStockQuantity", () => {
  it("passes through finite numbers", () => {
    expect(parseStockQuantity(500)).toBe(500);
    expect(parseStockQuantity(2.5)).toBe(2.5);
  });

  it("parses numeric strings", () => {
    expect(parseStockQuantity("500")).toBe(500);
    expect(parseStockQuantity("2.5")).toBe(2.5);
  });

  it("returns 0 for null, undefined, and invalid values", () => {
    expect(parseStockQuantity(null)).toBe(0);
    expect(parseStockQuantity(undefined)).toBe(0);
    expect(parseStockQuantity("not-a-number")).toBe(0);
  });
});

describe("normalizeFoodSupply", () => {
  it("coerces string stock_quantity to number", () => {
    const normalized = normalizeFoodSupply({
      id: "fs-1",
      title: "Flour",
      stock_quantity: "2500",
      unit: "gr",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(normalized.stock_quantity).toBe(2500);
  });
});
