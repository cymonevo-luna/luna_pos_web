import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  purchaseRequestsAdminApi,
  normalizePurchaseRequestItem,
  normalizePurchaseRequest,
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
      line_estimated_amount: "875",
    });

    expect(normalized.price_quantity).toBe(1000);
    expect(normalized.unit_price).toBe(140);
    expect(normalized.quantity).toBe(2.5);
    expect(normalized.price_amount).toBe(350);
    expect(normalized.line_estimated_amount).toBe(875);
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
      line_estimated_amount: 1800,
    });

    expect(normalized.quantity).toBe(3);
    expect(normalized.price_quantity).toBe(500);
    expect(normalized.unit_price).toBe(200);
    expect(normalized.price_amount).toBe(600);
    expect(normalized.line_estimated_amount).toBe(1800);
  });

  it("preserves line_estimated_amount distinct from price_amount", () => {
    const normalized = normalizePurchaseRequestItem({
      id: "item-ayam",
      food_supply_id: "fs-ayam",
      food_supply_title: "Ayam",
      unit: "piece",
      quantity: "3",
      price_quantity: "1",
      unit_price: "26000",
      price_amount: 26000,
      line_estimated_amount: 78000,
    });

    expect(normalized.price_amount).toBe(26000);
    expect(normalized.line_estimated_amount).toBe(78000);
    expect(normalized.line_estimated_amount).not.toBe(normalized.price_amount);
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
          food_supply_title: "Ayam",
          unit: "piece" as const,
          quantity: "3",
          price_quantity: "1",
          unit_price: "26000",
          price_amount: 26000,
          line_estimated_amount: 78000,
        },
      ],
      total_estimated_amount: "118000",
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
    expect(got.data.items[0]?.price_quantity).toBe(1);
    expect(got.data.items[0]?.unit_price).toBe(26000);
    expect(got.data.items[0]?.price_amount).toBe(26000);
    expect(got.data.items[0]?.line_estimated_amount).toBe(78000);
    expect(got.data.total_estimated_amount).toBe(118000);

    const created = await purchaseRequestsAdminApi.create({
      supplier_id: "sup-1",
      items: [{ food_supply_id: "fs-1", quantity: "3" }],
    });
    expect(created.data).toMatchObject({ id: "pr-1" });
    expect(created.data.total_estimated_amount).toBe(118000);

    const updated = await purchaseRequestsAdminApi.updateStatus("pr-1", {
      status: "REQUESTED",
    });
    expect(updated.data.status).toBe("REQUESTED");
    expect(updated.data.total_estimated_amount).toBe(118000);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("sends photo_url when provided for status update", async () => {
    const purchaseRequest = {
      id: "pr-1",
      supplier_id: "sup-1",
      supplier_name: "Beras Supplier",
      supplier_contact_info: "08123456789",
      status: "REQUESTED" as const,
      notes: null,
      items: [],
      total_estimated_amount: "118000",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (
          method === "PATCH" &&
          url.endsWith("/api/admin/purchase-requests/pr-1/status")
        ) {
          const body = JSON.parse(String(init?.body));
          expect(body).toEqual({
            status: "PAID",
            photo_url: "https://cdn.example.com/receipt.jpg",
          });
          return jsonResponse({
            success: true,
            data: { ...purchaseRequest, status: "PAID" },
          });
        }
        return jsonResponse({ success: false }, 404);
      },
    );

    const updated = await purchaseRequestsAdminApi.updateStatus("pr-1", {
      status: "PAID",
      photo_url: "https://cdn.example.com/receipt.jpg",
    });
    expect(updated.data.status).toBe("PAID");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("calls DELETE on the correct endpoint for delete", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (
          method === "DELETE" &&
          url.endsWith("/api/admin/purchase-requests/pr-1")
        ) {
          return new Response(null, { status: 204 });
        }
        return jsonResponse({ success: false }, 404);
      },
    );

    await purchaseRequestsAdminApi.delete("pr-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/purchase-requests/pr-1",
    );
    expect(init?.method).toBe("DELETE");
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
            total_estimated_amount: "560",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        meta: { page: 1, per_page: 10, total: 1 },
      }),
    );

    const result = await purchaseRequestsAdminApi.list();
    expect(result.data[0]?.total_estimated_amount).toBe(560);
    expect(result.data[0]?.item_count).toBe(2);
  });

  it("calls suggest and batch endpoints with normalized responses", async () => {
    const suggestData = {
      items: [
        {
          food_supply_id: "fs-rice",
          food_supply_title: "Rice",
          quantity: "2",
          unit: "gr" as const,
          has_supplier_price: true,
          selected_supplier_id: "sup-cheap",
          selected_supplier_name: "Cheap Supplier",
          price_amount: "100000",
          price_quantity: "1000",
          unit_price: "100",
          line_estimated_amount: "200",
          all_supplier_quotes: [
            {
              supplier_id: "sup-cheap",
              supplier_name: "Cheap Supplier",
              price_amount: "100000",
              price_quantity: "1000",
              unit_price: "100",
            },
          ],
        },
      ],
      grouped_by_supplier: [
        {
          supplier_id: "sup-cheap",
          supplier_name: "Cheap Supplier",
          group_total_estimated_amount: "200",
          items: [
            {
              food_supply_id: "fs-rice",
              food_supply_title: "Rice",
              quantity: "2",
              unit: "gr" as const,
              has_supplier_price: true,
              selected_supplier_id: "sup-cheap",
              selected_supplier_name: "Cheap Supplier",
              price_amount: "100000",
              price_quantity: "1000",
              unit_price: "100",
              line_estimated_amount: "200",
              all_supplier_quotes: [],
            },
          ],
        },
      ],
    };

    const purchaseRequest = {
      id: "pr-1",
      supplier_id: "sup-cheap",
      supplier_name: "Cheap Supplier",
      supplier_contact_info: "08123456789",
      status: "PENDING" as const,
      notes: null,
      items: [],
      total_estimated_amount: "200",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (
          method === "POST" &&
          url.endsWith("/api/admin/purchase-requests/suggest")
        ) {
          const body = JSON.parse(String(init?.body));
          expect(body).toEqual({
            items: [{ food_supply_id: "fs-rice", quantity: "2" }],
          });
          return jsonResponse({ success: true, data: suggestData });
        }

        if (
          method === "POST" &&
          url.endsWith("/api/admin/purchase-requests/batch")
        ) {
          const body = JSON.parse(String(init?.body));
          expect(body).toEqual({
            groups: [
              {
                supplier_id: "sup-cheap",
                items: [{ food_supply_id: "fs-rice", quantity: "2" }],
              },
            ],
          });
          return jsonResponse({
            success: true,
            data: { purchase_requests: [purchaseRequest] },
          });
        }

        return jsonResponse({ success: false }, 404);
      },
    );

    const suggested = await purchaseRequestsAdminApi.suggest({
      items: [{ food_supply_id: "fs-rice", quantity: "2" }],
    });
    expect(suggested.data.items[0]?.line_estimated_amount).toBe(200);

    const batched = await purchaseRequestsAdminApi.batch({
      groups: [
        {
          supplier_id: "sup-cheap",
          items: [{ food_supply_id: "fs-rice", quantity: "2" }],
        },
      ],
    });
    expect(batched.data.purchase_requests[0]?.status).toBe("PENDING");
    expect(fetchMock).toHaveBeenCalled();
  });
});

describe("normalizePurchaseRequest regression", () => {
  it("defaults total_estimated_amount to 0 when field is omitted (old total_amount key was the bug)", () => {
    const raw = {
      id: "pr-1",
      supplier_id: "sup-1",
      supplier_name: "Supplier",
      supplier_contact_info: "08123",
      status: "PENDING" as const,
      notes: null,
      items: [],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const normalized = normalizePurchaseRequest(
      raw as unknown as Parameters<typeof normalizePurchaseRequest>[0],
    );

    expect(normalized.total_estimated_amount).toBe(0);
  });

  it("defaults status_history to an empty array when omitted", () => {
    const raw = {
      id: "pr-1",
      supplier_id: "sup-1",
      supplier_name: "Supplier",
      supplier_contact_info: "08123",
      status: "PENDING" as const,
      notes: null,
      items: [],
      total_estimated_amount: 0,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const normalized = normalizePurchaseRequest(
      raw as unknown as Parameters<typeof normalizePurchaseRequest>[0],
    );

    expect(normalized.status_history).toEqual([]);
  });

  it("preserves status_history entries from the API", () => {
    const normalized = normalizePurchaseRequest({
      id: "pr-1",
      supplier_id: "sup-1",
      supplier_name: "Supplier",
      supplier_contact_info: "08123",
      status: "PAID",
      notes: null,
      items: [],
      total_estimated_amount: 0,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
      status_history: [
        {
          id: "hist-1",
          from_status: "PENDING",
          to_status: "REQUESTED",
          changed_by_username: "admin",
          photo_url: null,
          created_at: "2026-01-01T08:00:00Z",
        },
      ],
    });

    expect(normalized.status_history).toHaveLength(1);
    expect(normalized.status_history[0]).toMatchObject({
      to_status: "REQUESTED",
      changed_by_username: "admin",
    });
  });
});
