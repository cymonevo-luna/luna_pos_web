import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  suppliersAdminApi,
  parseQuantity,
  normalizeSupplier,
} from "./suppliers";
import { supplierSchema } from "@/lib/validations";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const foodItem = {
  food_supply_id: "fs-1",
  price: 10000,
  quantity: 2,
  unit: "gr" as const,
};

describe("supplierSchema", () => {
  const base = {
    name: "Beras Supplier",
    phone_number: "08123456789",
    address: "Jl. Pasar 12",
    supports_delivery: true,
    delivery_cost: 5000,
    food_items: [foodItem],
  };

  it("accepts a complete supplier with two food items and delivery enabled", () => {
    const result = supplierSchema.safeParse({
      ...base,
      food_items: [
        foodItem,
        {
          food_supply_id: "fs-2",
          price: 25000,
          quantity: 1.5,
          unit: "ml",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty food_items array", () => {
    const result = supplierSchema.safeParse({
      ...base,
      food_items: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects supports_delivery true without delivery_cost", () => {
    const result = supplierSchema.safeParse({
      ...base,
      delivery_cost: undefined,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.includes("delivery_cost")),
      ).toBe(true);
    }
  });

  it("rejects supports_delivery false with positive delivery_cost", () => {
    const result = supplierSchema.safeParse({
      ...base,
      supports_delivery: false,
      delivery_cost: 5000,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.includes("delivery_cost")),
      ).toBe(true);
    }
  });

  it("accepts supports_delivery false with omitted delivery_cost", () => {
    const result = supplierSchema.safeParse({
      name: base.name,
      phone_number: base.phone_number,
      address: base.address,
      supports_delivery: false,
      food_items: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts supports_delivery false with zero delivery_cost", () => {
    const result = supplierSchema.safeParse({
      ...base,
      supports_delivery: false,
      delivery_cost: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid price on food items", () => {
    const result = supplierSchema.safeParse({
      ...base,
      food_items: [{ ...foodItem, price: 0 }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.includes("price")),
      ).toBe(true);
    }
  });

  it("rejects a name shorter than 2 characters", () => {
    const result = supplierSchema.safeParse({
      ...base,
      name: "A",
    });
    expect(result.success).toBe(false);
  });

  it("trims phone_number before length validation", () => {
    const result = supplierSchema.safeParse({
      ...base,
      phone_number: "  08123  ",
    });
    expect(result.success).toBe(true);
  });
});

describe("suppliersAdminApi", () => {
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

    await suppliersAdminApi.list({
      page: 2,
      perPage: 5,
      search: "beras",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/suppliers?page=2&per_page=5&search=beras",
    );
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
  });

  it("unwraps envelope responses for get, create, update, and delete", async () => {
    const supplier = {
      id: "sup-1",
      name: "Beras Supplier",
      phone_number: "08123456789",
      address: "Jl. Pasar 12",
      supports_delivery: true,
      delivery_cost: 5000,
      food_items: [
        {
          food_supply_id: "fs-1",
          food_supply_title: "Beras",
          price: 10000,
          quantity: 2,
          unit: "gr" as const,
        },
      ],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (method === "GET" && url.endsWith("/api/admin/suppliers/sup-1")) {
          return jsonResponse({ success: true, data: supplier });
        }
        if (method === "POST" && url.endsWith("/api/admin/suppliers")) {
          return jsonResponse({ success: true, data: supplier });
        }
        if (method === "PUT" && url.endsWith("/api/admin/suppliers/sup-1")) {
          return jsonResponse({ success: true, data: supplier });
        }
        if (
          method === "DELETE" &&
          url.endsWith("/api/admin/suppliers/sup-1")
        ) {
          return new Response(null, { status: 204 });
        }
        return jsonResponse({ success: false }, 404);
      },
    );

    const got = await suppliersAdminApi.get("sup-1");
    expect(got.data).toEqual(supplier);

    const created = await suppliersAdminApi.create({
      name: "Beras Supplier",
      phone_number: "08123456789",
      address: "Jl. Pasar 12",
      supports_delivery: true,
      delivery_cost: 5000,
      food_items: [
        {
          food_supply_id: "fs-1",
          price: 10000,
          quantity: 2,
          unit: "gr",
        },
      ],
    });
    expect(created.data).toEqual(supplier);

    const updated = await suppliersAdminApi.update("sup-1", {
      name: "Beras Supplier",
      phone_number: "08123456789",
      address: "Jl. Pasar 12",
      supports_delivery: true,
      delivery_cost: 5000,
      food_items: [
        {
          food_supply_id: "fs-1",
          price: 10000,
          quantity: 2,
          unit: "gr",
        },
      ],
    });
    expect(updated.data).toEqual(supplier);

    await suppliersAdminApi.delete("sup-1");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("normalizes string quantity from list API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          {
            id: "sup-1",
            name: "Beras Supplier",
            phone_number: "08123456789",
            address: "Jl. Pasar 12",
            supports_delivery: false,
            delivery_cost: null,
            food_items: [
              {
                food_supply_id: "fs-1",
                food_supply_title: "Beras",
                price: 10000,
                quantity: "5000",
                unit: "gr",
              },
            ],
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        meta: { page: 1, per_page: 10, total: 1 },
      }),
    );

    const result = await suppliersAdminApi.list();
    expect(result.data[0]?.food_items[0]?.quantity).toBe(5000);
    expect(typeof result.data[0]?.food_items[0]?.quantity).toBe("number");
  });

  it("normalizes string delivery_cost from create API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          success: true,
          data: {
            id: "sup-2",
            name: "Milk Supplier",
            phone_number: "08123456789",
            address: "Jl. Pasar 12",
            supports_delivery: true,
            delivery_cost: "7500",
            food_items: [],
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        },
        201,
      ),
    );

    const result = await suppliersAdminApi.create({
      name: "Milk Supplier",
      phone_number: "08123456789",
      address: "Jl. Pasar 12",
      supports_delivery: true,
      delivery_cost: 7500,
      food_items: [],
    });
    expect(result.data?.delivery_cost).toBe(7500);
    expect(typeof result.data?.delivery_cost).toBe("number");
  });
});

describe("parseQuantity", () => {
  it("passes through finite numbers", () => {
    expect(parseQuantity(5000)).toBe(5000);
    expect(parseQuantity(2.5)).toBe(2.5);
  });

  it("parses numeric strings", () => {
    expect(parseQuantity("5000")).toBe(5000);
    expect(parseQuantity("2.5")).toBe(2.5);
  });

  it("returns 0 for null, undefined, and invalid values", () => {
    expect(parseQuantity(null)).toBe(0);
    expect(parseQuantity(undefined)).toBe(0);
    expect(parseQuantity("not-a-number")).toBe(0);
  });
});

describe("normalizeSupplier", () => {
  it("coerces string quantity to number", () => {
    const normalized = normalizeSupplier({
      id: "sup-1",
      name: "Beras Supplier",
      phone_number: "08123456789",
      address: "Jl. Pasar 12",
      supports_delivery: false,
      delivery_cost: null,
      food_items: [
        {
          food_supply_id: "fs-1",
          food_supply_title: "Beras",
          price: 10000,
          quantity: "5000",
          unit: "gr",
        },
      ],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(normalized.food_items[0]?.quantity).toBe(5000);
  });
});
