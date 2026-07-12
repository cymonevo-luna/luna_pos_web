import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getMenuStockEstimation } from "./menu-stock-estimation";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const stockEstimationResponse = {
  has_formula: true,
  requested_quantity: 10,
  max_producible: 15,
  is_fully_producible: true,
  limiting_ingredient_title: "Rice",
  message: null,
  ingredients: [
    {
      food_supply_title: "Rice",
      unit: "gr",
      quantity_per_unit: "200",
      required_quantity: "2000",
      current_stock_quantity: "5000",
      remaining_after: "3000",
      is_sufficient: true,
    },
  ],
};

describe("menu stock estimation API", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads stock estimation and normalizes decimal fields", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: stockEstimationResponse,
      }),
    );

    const result = await getMenuStockEstimation("menu-1", 10);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/menus/menu-1/stock-estimation?quantity=10",
    );
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
    expect(result.data).toEqual({
      has_formula: true,
      requested_quantity: 10,
      max_producible: 15,
      is_fully_producible: true,
      limiting_ingredient_title: "Rice",
      message: null,
      ingredients: [
        {
          food_supply_title: "Rice",
          unit: "gr",
          quantity_per_unit: 200,
          required_quantity: 2000,
          current_stock_quantity: 5000,
          remaining_after: 3000,
          is_sufficient: true,
        },
      ],
    });
  });

  it("returns no-formula response without ingredients", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          has_formula: false,
          requested_quantity: 1,
          message: "No ingredient formula saved for this menu.",
        },
      }),
    );

    const result = await getMenuStockEstimation("menu-1", 1);

    expect(result.data.has_formula).toBe(false);
    expect(result.data.message).toBe(
      "No ingredient formula saved for this menu.",
    );
    expect(result.data.ingredients).toBeUndefined();
  });
});
