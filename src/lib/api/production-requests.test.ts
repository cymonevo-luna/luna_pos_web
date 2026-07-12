import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  productionRequestsAdminApi,
  normalizeProductionRequestItem,
  normalizeProductionRequest,
  normalizeProductionAggregatedIngredient,
  productionRequestFormToPayload,
} from "./production-requests";
import { productionRequestFormSchema } from "@/lib/validations";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const lineStockEstimationRaw = {
  has_formula: true,
  is_fully_producible: true,
  limiting_ingredient_title: "Rice",
  ingredients: [
    {
      food_supply_id: "fs-1",
      food_supply_title: "Rice",
      unit: "gr" as const,
      quantity_per_unit: "200",
      required_quantity: "2000",
      current_stock_quantity: "5000",
      remaining_after: "3000",
      is_sufficient: true,
      max_producible_from_supply: 25,
    },
  ],
};

describe("normalizeProductionRequestItem", () => {
  it("coerces string decimal fields in stock estimation to numbers", () => {
    const normalized = normalizeProductionRequestItem({
      id: "item-1",
      menu_id: "menu-1",
      menu_title: "Nasi Goreng",
      quantity: 10,
      is_finished: false,
      stock_estimation: lineStockEstimationRaw,
    });

    expect(normalized.stock_estimation.ingredients[0]?.quantity_per_unit).toBe(
      200,
    );
    expect(normalized.stock_estimation.ingredients[0]?.required_quantity).toBe(
      2000,
    );
    expect(
      normalized.stock_estimation.ingredients[0]?.current_stock_quantity,
    ).toBe(5000);
    expect(normalized.stock_estimation.ingredients[0]?.remaining_after).toBe(
      3000,
    );
  });

  it("passes through numeric fields", () => {
    const normalized = normalizeProductionRequestItem({
      id: "item-1",
      menu_id: "menu-1",
      menu_title: "Nasi Goreng",
      quantity: 5,
      is_finished: true,
      stock_estimation: {
        has_formula: true,
        is_fully_producible: true,
        ingredients: [
          {
            food_supply_id: "fs-1",
            food_supply_title: "Rice",
            unit: "gr",
            quantity_per_unit: 100,
            required_quantity: 500,
            current_stock_quantity: 1000,
            remaining_after: 500,
            is_sufficient: true,
          },
        ],
      },
    });

    expect(normalized.quantity).toBe(5);
    expect(normalized.is_finished).toBe(true);
    expect(normalized.stock_estimation.ingredients[0]?.required_quantity).toBe(
      500,
    );
  });
});

describe("normalizeProductionAggregatedIngredient", () => {
  it("coerces string decimal fields to numbers", () => {
    const normalized = normalizeProductionAggregatedIngredient({
      food_supply_id: "fs-1",
      food_supply_title: "Rice",
      unit: "gr",
      required_quantity: "2500",
      current_stock_quantity: "5000",
      remaining_after: "2500",
      is_sufficient: true,
    });

    expect(normalized.required_quantity).toBe(2500);
    expect(normalized.current_stock_quantity).toBe(5000);
    expect(normalized.remaining_after).toBe(2500);
  });
});

describe("productionRequestFormSchema", () => {
  const base = {
    items: [{ menu_id: "menu-1", quantity: 2 }],
  };

  it("accepts a valid production request", () => {
    const result = productionRequestFormSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("rejects empty items", () => {
    expect(() =>
      productionRequestFormSchema.parse({
        ...base,
        items: [],
      }),
    ).toThrow();
  });

  it("rejects zero quantity", () => {
    expect(() =>
      productionRequestFormSchema.parse({
        ...base,
        items: [{ menu_id: "menu-1", quantity: 0 }],
      }),
    ).toThrow();
  });

  it("rejects non-integer quantity", () => {
    expect(() =>
      productionRequestFormSchema.parse({
        ...base,
        items: [{ menu_id: "menu-1", quantity: 1.5 }],
      }),
    ).toThrow();
  });
});

describe("productionRequestFormToPayload", () => {
  it("maps two menu lines to API payload with menu_id and quantity", () => {
    expect(
      productionRequestFormToPayload({
        items: [
          { menu_id: "menu-1", quantity: 5 },
          { menu_id: "menu-2", quantity: 10 },
        ],
        notes: "Morning batch",
      }),
    ).toEqual({
      items: [
        { menu_id: "menu-1", quantity: 5 },
        { menu_id: "menu-2", quantity: 10 },
      ],
      notes: "Morning batch",
    });
  });

  it("omits blank notes", () => {
    expect(
      productionRequestFormToPayload({
        items: [{ menu_id: "menu-1", quantity: 1 }],
        notes: "",
      }),
    ).toEqual({
      items: [{ menu_id: "menu-1", quantity: 1 }],
    });
  });
});

describe("productionRequestsAdminApi", () => {
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

    await productionRequestsAdminApi.list({
      page: 1,
      perPage: 10,
      status: "REQUESTED",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/production-requests?page=1&per_page=10&status=REQUESTED",
    );
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
  });

  it("unwraps envelope responses for get, create, estimate, update, updateStatus, and markItemFinished", async () => {
    const productionRequest = {
      id: "pr-1",
      status: "REQUESTED" as const,
      is_fully_producible: true,
      items: [
        {
          id: "item-1",
          menu_id: "menu-1",
          menu_title: "Nasi Goreng",
          quantity: 10,
          is_finished: false,
          stock_estimation: lineStockEstimationRaw,
        },
      ],
      aggregated_ingredients: [
        {
          food_supply_id: "fs-1",
          food_supply_title: "Rice",
          unit: "gr" as const,
          required_quantity: "2000",
          current_stock_quantity: "5000",
          remaining_after: "3000",
          is_sufficient: true,
        },
      ],
      status_history: [],
      notes: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const estimateResponse = {
      is_fully_producible: true,
      items: [
        {
          menu_id: "menu-1",
          menu_title: "Nasi Goreng",
          quantity: 10,
          stock_estimation: lineStockEstimationRaw,
        },
      ],
      aggregated_ingredients: productionRequest.aggregated_ingredients,
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (
          method === "GET" &&
          url.endsWith("/api/admin/production-requests/pr-1")
        ) {
          return jsonResponse({ success: true, data: productionRequest });
        }
        if (
          method === "POST" &&
          url.endsWith("/api/admin/production-requests/estimate")
        ) {
          return jsonResponse({ success: true, data: estimateResponse });
        }
        if (
          method === "POST" &&
          url.endsWith("/api/admin/production-requests")
        ) {
          return jsonResponse({ success: true, data: productionRequest });
        }
        if (
          method === "PUT" &&
          url.endsWith("/api/admin/production-requests/pr-1")
        ) {
          return jsonResponse({ success: true, data: productionRequest });
        }
        if (
          method === "PATCH" &&
          url.endsWith("/api/admin/production-requests/pr-1/status")
        ) {
          return jsonResponse({
            success: true,
            data: { ...productionRequest, status: "ACCEPTED" },
          });
        }
        if (
          method === "PATCH" &&
          url.endsWith("/api/admin/production-requests/pr-1/items/item-1")
        ) {
          return jsonResponse({
            success: true,
            data: {
              ...productionRequest,
              items: [
                {
                  ...productionRequest.items[0],
                  is_finished: true,
                },
              ],
            },
          });
        }
        return jsonResponse({ success: false }, 404);
      },
    );

    const got = await productionRequestsAdminApi.get("pr-1");
    expect(got.data.items[0]?.stock_estimation.ingredients[0]?.required_quantity).toBe(
      2000,
    );
    expect(got.data.aggregated_ingredients[0]?.required_quantity).toBe(2000);

    const estimated = await productionRequestsAdminApi.estimate({
      items: [{ menu_id: "menu-1", quantity: 10 }],
    });
    expect(estimated.data.is_fully_producible).toBe(true);
    expect(
      estimated.data.items[0]?.stock_estimation.ingredients[0]?.quantity_per_unit,
    ).toBe(200);

    const created = await productionRequestsAdminApi.create({
      items: [{ menu_id: "menu-1", quantity: 10 }],
    });
    expect(created.data).toMatchObject({ id: "pr-1" });

    const updated = await productionRequestsAdminApi.update("pr-1", {
      items: [{ menu_id: "menu-1", quantity: 12 }],
    });
    expect(updated.data.id).toBe("pr-1");

    const statusUpdated = await productionRequestsAdminApi.updateStatus(
      "pr-1",
      "ACCEPTED",
    );
    expect(statusUpdated.data.status).toBe("ACCEPTED");

    const itemUpdated = await productionRequestsAdminApi.markItemFinished(
      "pr-1",
      "item-1",
      true,
    );
    expect(itemUpdated.data.items[0]?.is_finished).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("normalizes aggregated ingredients from list API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          {
            id: "pr-1",
            status: "REQUESTED",
            is_fully_producible: true,
            item_count: 2,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        meta: { page: 1, per_page: 10, total: 1 },
      }),
    );

    const result = await productionRequestsAdminApi.list();
    expect(result.data[0]?.item_count).toBe(2);
    expect(result.data[0]?.status).toBe("REQUESTED");
  });
});

describe("normalizeProductionRequest regression", () => {
  it("defaults aggregated_ingredients and status_history when omitted", () => {
    const normalized = normalizeProductionRequest({
      id: "pr-1",
      status: "REQUESTED",
      is_fully_producible: false,
      items: [],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });

    expect(normalized.aggregated_ingredients).toEqual([]);
    expect(normalized.status_history).toEqual([]);
  });
});
