import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getOrderOptionIngredients,
  replaceOrderOptionIngredients,
} from "./order-option-ingredients";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ingredientsResponse = {
  order_option_id: "opt-1",
  ingredients: [
    {
      food_supply_id: "supply-1",
      quantity: "1",
      food_supply_title: "Paper",
      food_supply_unit: "piece",
      current_stock_quantity: "500",
    },
  ],
};

describe("order option ingredients API", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads order option ingredients and normalizes decimal fields", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: ingredientsResponse,
      }),
    );

    const result = await getOrderOptionIngredients("opt-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/order-options/opt-1/ingredients",
    );
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
    expect(result.data).toEqual({
      order_option_id: "opt-1",
      ingredients: [
        {
          food_supply_id: "supply-1",
          quantity: 1,
          food_supply_title: "Paper",
          food_supply_unit: "piece",
          current_stock_quantity: 500,
        },
      ],
    });
  });

  it("replaces order option ingredients with a replace-all payload", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          order_option_id: "opt-1",
          ingredients: [],
        },
      }),
    );

    await replaceOrderOptionIngredients("opt-1", [
      { food_supply_id: "supply-1", quantity: 1.25 },
    ]);

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("PUT");
    expect(init?.body).toBe(
      JSON.stringify({
        ingredients: [{ food_supply_id: "supply-1", quantity: 1.25 }],
      }),
    );
  });
});
