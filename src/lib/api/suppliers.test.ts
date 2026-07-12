import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  suppliersAdminApi,
  parseNumeric,
  normalizeSupplier,
  supplierPriceFormToPayload,
} from "./suppliers";
import { supplierSchema, supplierPriceSchema } from "@/lib/validations";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("supplierSchema", () => {
  const base = {
    name: "Beras Supplier",
    phone_number: "08123456789",
    address: "Jl. Pasar 12",
    supports_delivery: true,
    delivery_cost: 5000,
  };

  it("accepts a complete supplier with delivery enabled", () => {
    const result = supplierSchema.safeParse(base);
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
    });
    expect(result.success).toBe(true);
  });

  it("rejects a name shorter than 2 characters", () => {
    const result = supplierSchema.safeParse({
      ...base,
      name: "A",
    });
    expect(result.success).toBe(false);
  });
});

describe("supplierPriceSchema", () => {
  it("accepts valid price quote values", () => {
    const result = supplierPriceSchema.safeParse({
      food_supply_id: "fs-1",
      price_amount: 140000,
      price_quantity: 1000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects zero price_amount", () => {
    const result = supplierPriceSchema.safeParse({
      food_supply_id: "fs-1",
      price_amount: 0,
      price_quantity: 1000,
    });
    expect(result.success).toBe(false);
  });
});

describe("supplierPriceFormToPayload", () => {
  it("maps form values to API payload", () => {
    expect(
      supplierPriceFormToPayload({
        food_supply_id: "fs-1",
        price_amount: 140000,
        price_quantity: 1000,
      }),
    ).toEqual({
      food_supply_id: "fs-1",
      price_amount: 140000,
      price_quantity: 1000,
    });
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

  it("unwraps envelope responses for supplier and price endpoints", async () => {
    const supplier = {
      id: "sup-1",
      name: "Beras Supplier",
      phone_number: "08123456789",
      address: "Jl. Pasar 12",
      supports_delivery: true,
      delivery_cost: 5000,
      price_quotes: [
        {
          id: "price-1",
          food_supply_id: "fs-1",
          food_supply_title: "Beras",
          price_amount: 140000,
          price_quantity: 1000,
          unit: "gr" as const,
          unit_price: 140,
        },
      ],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const price = supplier.price_quotes[0];

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
        if (
          method === "POST" &&
          url.endsWith("/api/admin/suppliers/sup-1/prices")
        ) {
          return jsonResponse({ success: true, data: price });
        }
        if (
          method === "PUT" &&
          url.endsWith("/api/admin/supplier-prices/price-1")
        ) {
          return jsonResponse({ success: true, data: price });
        }
        if (
          method === "DELETE" &&
          url.endsWith("/api/admin/supplier-prices/price-1")
        ) {
          return new Response(null, { status: 204 });
        }
        return jsonResponse({ success: false }, 404);
      },
    );

    const got = await suppliersAdminApi.get("sup-1");
    expect(got.data.price_quotes[0]?.price_amount).toBe(140000);

    const created = await suppliersAdminApi.create({
      name: "Beras Supplier",
      phone_number: "08123456789",
      address: "Jl. Pasar 12",
      supports_delivery: true,
      delivery_cost: 5000,
    });
    expect(created.data).toMatchObject({ id: "sup-1" });

    const updated = await suppliersAdminApi.update("sup-1", {
      name: "Beras Supplier",
      phone_number: "08123456789",
      address: "Jl. Pasar 12",
      supports_delivery: true,
      delivery_cost: 5000,
    });
    expect(updated.data).toMatchObject({ id: "sup-1" });

    await suppliersAdminApi.delete("sup-1");

    const createdPrice = await suppliersAdminApi.createPrice("sup-1", {
      food_supply_id: "fs-1",
      price_amount: 140000,
      price_quantity: 1000,
    });
    expect(createdPrice.data?.id).toBe("price-1");

    const updatedPrice = await suppliersAdminApi.updatePrice("price-1", {
      food_supply_id: "fs-1",
      price_amount: 150000,
      price_quantity: 1000,
    });
    expect(updatedPrice.data?.price_amount).toBe(140000);

    await suppliersAdminApi.deletePrice("price-1");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("normalizes string quantities from list API", async () => {
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
            price_quotes: [
              {
                id: "price-1",
                food_supply_id: "fs-1",
                food_supply_title: "Beras",
                price_amount: "140000",
                price_quantity: "1000",
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
    expect(result.data[0]?.price_quotes[0]?.price_quantity).toBe(1000);
    expect(result.data[0]?.price_quotes_count).toBe(1);
  });
});

describe("parseNumeric", () => {
  it("passes through finite numbers", () => {
    expect(parseNumeric(5000)).toBe(5000);
    expect(parseNumeric(2.5)).toBe(2.5);
  });

  it("parses numeric strings", () => {
    expect(parseNumeric("5000")).toBe(5000);
    expect(parseNumeric("2.5")).toBe(2.5);
  });

  it("returns 0 for null, undefined, and invalid values", () => {
    expect(parseNumeric(null)).toBe(0);
    expect(parseNumeric(undefined)).toBe(0);
    expect(parseNumeric("not-a-number")).toBe(0);
  });
});

describe("normalizeSupplier", () => {
  it("coerces string price fields to numbers", () => {
    const normalized = normalizeSupplier({
      id: "sup-1",
      name: "Beras Supplier",
      phone_number: "08123456789",
      address: "Jl. Pasar 12",
      supports_delivery: false,
      delivery_cost: null,
      price_quotes: [
        {
          id: "price-1",
          food_supply_id: "fs-1",
          food_supply_title: "Beras",
          price_amount: "140000",
          price_quantity: "1000",
          unit: "gr",
        },
      ],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(normalized.price_quotes[0]?.price_amount).toBe(140000);
    expect(normalized.price_quotes_count).toBe(1);
  });
});
