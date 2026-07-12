import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  purchaseRequestsAdminApi,
  normalizePurchaseRequestItem,
  purchaseRequestFormToPayload,
} from "./purchase-requests";
import { purchaseRequestSchema } from "@/lib/validations";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("normalizePurchaseRequestItem", () => {
  it("coerces string decimal fields to numbers", () => {
    const normalized = normalizePurchaseRequestItem({
      id: "item-1",
      food_supply_id: "fs-1",
      food_supply_title: "Beras",
      unit: "gr",
      quantity: "2.5",
      price_quantity: "1000",
      unit_price: "140",
      price_amount: "350",
    });

    expect(normalized.price_quantity).toBe(1000);
    expect(normalized.unit_price).toBe(140);
    expect(normalized.quantity).toBe(2.5);
    expect(normalized.price_amount).toBe(350);
    expect(Number.isNaN(normalized.price_quantity)).toBe(false);
    expect(Number.isNaN(normalized.unit_price)).toBe(false);
  });

  it("passes through numeric fields", () => {
    const normalized = normalizePurchaseRequestItem({
      id: "item-1",
      food_supply_id: "fs-1",
      quantity: 3,
      price_quantity: 500,
      unit_price: 200,
      price_amount: 600,
    });

    expect(normalized.quantity).toBe(3);
    expect(normalized.price_quantity).toBe(500);
    expect(normalized.unit_price).toBe(200);
    expect(normalized.price_amount).toBe(600);
  });
});

describe("purchaseRequestSchema", () => {
  const base = {
    supplier_id: "sup-1",
    items: [{ food_supply_id: "fs-1", quantity: 2 }],
  };

  it("accepts a valid purchase request", () => {
    const result = purchaseRequestSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("rejects empty items", () => {
    expect(() =>
      purchaseRequestSchema.parse({
        ...base,
        items: [],
      }),
    ).toThrow();
  });

  it("rejects zero quantity", () => {
    expect(() =>
      purchaseRequestSchema.parse({
        ...base,
        items: [{ food_supply_id: "x", quantity: 0 }],
      }),
    ).toThrow();
  });
});

describe("purchaseRequestFormToPayload", () => {
  it("maps quantities to decimal strings", () => {
    expect(
      purchaseRequestFormToPayload({
        supplier_id: "sup-1",
        items: [
          { food_supply_id: "fs-1", quantity: 2.5 },
          { food_supply_id: "fs-2", quantity: 10 },
        ],
        notes: "Urgent",
      }),
    ).toEqual({
      supplier_id: "sup-1",
      items: [
        { food_supply_id: "fs-1", quantity: "2.5" },
        { food_supply_id: "fs-2", quantity: "10" },
      ],
      notes: "Urgent",
    });
  });

  it("omits blank notes", () => {
    expect(
      purchaseRequestFormToPayload({
        supplier_id: "sup-1",
        items: [{ food_supply_id: "fs-1", quantity: 1 }],
        notes: "",
      }),
    ).toEqual({
      supplier_id: "sup-1",
      items: [{ food_supply_id: "fs-1", quantity: "1" }],
    });
  });
});

describe("purchaseRequestsAdminApi", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds the correct list URL with filters and attaches authorization", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse({
          success: true,
          data: [],
          meta: { page: 1, per_page: 10, total: 0 },
        }),
      );

    await purchaseRequestsAdminApi.list({
      page: 1,
      perPage: 10,
      status: "PENDING",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/purchase-requests?page=1&per_page=10&status=PENDING",
    );
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
  });

  it("unwraps envelope responses for get, create, and updateStatus", async () => {
    const purchaseRequest = {
      id: "pr-1",
      supplier_id: "sup-1",
      supplier_name: "Beras Supplier",
      supplier_contact_info: "08123456789",
      status: "PENDING" as const,
      notes: null,
      items: [
        {
          id: "item-1",
          food_supply_id: "fs-1",
          food_supply_title: "Beras",
          unit: "gr" as const,
          quantity: "2",
          price_quantity: "1000",
          unit_price: "140",
          price_amount: "280",
        },
      ],
      total_amount: "280",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (
          method === "GET" &&
          url.endsWith("/api/admin/purchase-requests/pr-1")
        ) {
          return jsonResponse({ success: true, data: purchaseRequest });
        }
        if (method === "POST" && url.endsWith("/api/admin/purchase-requests")) {
          return jsonResponse({ success: true, data: purchaseRequest });
        }
        if (
          method === "PATCH" &&
          url.endsWith("/api/admin/purchase-requests/pr-1/status")
        ) {
          return jsonResponse({
            success: true,
            data: { ...purchaseRequest, status: "REQUESTED" },
          });
        }
        return jsonResponse({ success: false }, 404);
      },
    );

    const got = await purchaseRequestsAdminApi.get("pr-1");
    expect(got.data.items[0]?.price_quantity).toBe(1000);
    expect(got.data.items[0]?.unit_price).toBe(140);
    expect(got.data.total_amount).toBe(280);

    const created = await purchaseRequestsAdminApi.create({
      supplier_id: "sup-1",
      items: [{ food_supply_id: "fs-1", quantity: "2" }],
    });
    expect(created.data).toMatchObject({ id: "pr-1" });

    const updated = await purchaseRequestsAdminApi.updateStatus(
      "pr-1",
      "REQUESTED",
    );
    expect(updated.data.status).toBe("REQUESTED");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("normalizes string amounts from list API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          {
            id: "pr-1",
            supplier_id: "sup-1",
            supplier_name: "Beras Supplier",
            status: "PENDING",
            item_count: 2,
            total_amount: "560",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        meta: { page: 1, per_page: 10, total: 1 },
      }),
    );

    const result = await purchaseRequestsAdminApi.list();
    expect(result.data[0]?.total_amount).toBe(560);
    expect(result.data[0]?.item_count).toBe(2);
  });
});
