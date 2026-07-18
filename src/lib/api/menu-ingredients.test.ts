import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getMenuIngredients,
  replaceMenuIngredients,
} from "./menu-ingredients";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const formulaResponse = {
  menu_id: "menu-1",
  ingredients: [
    {
      food_supply_id: "supply-1",
      quantity_per_unit: "2.5",
      entry_quantity: "0.5",
      cooking_measurement_id: "cm-1",
      cooking_measurement_name: "Tablespoon",
      food_supply_title: "Olive oil",
      food_supply_unit: "ml",
      food_supply_stock_quantity: "100",
    },
  ],
};

describe("menu ingredients API", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads menu ingredients and normalizes decimal fields", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: formulaResponse,
      }),
    );

    const result = await getMenuIngredients("menu-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/menus/menu-1/ingredients",
    );
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
    expect(result.data).toEqual({
      menu_id: "menu-1",
      ingredients: [
        {
          food_supply_id: "supply-1",
          quantity_per_unit: 2.5,
          entry_quantity: 0.5,
          cooking_measurement_id: "cm-1",
          cooking_measurement_name: "Tablespoon",
          food_supply_title: "Olive oil",
          food_supply_unit: "ml",
          food_supply_stock_quantity: 100,
        },
      ],
    });
  });

  it("maps live API unit and current_stock_quantity fields", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          menu_id: "menu-1",
          ingredients: [
            {
              id: "ingredient-1",
              food_supply_id: "supply-1",
              food_supply_title: "Rice",
              unit: "gr",
              quantity_per_unit: "200",
              current_stock_quantity: "4400",
            },
          ],
        },
      }),
    );

    const result = await getMenuIngredients("menu-1");

    expect(result.data.ingredients[0]).toEqual({
      id: "ingredient-1",
      food_supply_id: "supply-1",
      food_supply_title: "Rice",
      food_supply_unit: "gr",
      quantity_per_unit: 200,
      food_supply_stock_quantity: 4400,
    });
  });

  it("replaces menu ingredients with a replace-all payload", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          menu_id: "menu-1",
          ingredients: [],
        },
      }),
    );

    await replaceMenuIngredients("menu-1", [
      { food_supply_id: "supply-1", quantity_per_unit: 1.25 },
      {
        food_supply_id: "supply-2",
        quantity_per_unit: 0.5,
        cooking_measurement_id: "cm-1",
      },
      { ingredient_menu_id: "menu-sambal", quantity_per_unit: 20 },
    ]);

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("PUT");
    expect(init?.body).toBe(
      JSON.stringify({
        ingredients: [
          { food_supply_id: "supply-1", quantity_per_unit: 1.25 },
          {
            food_supply_id: "supply-2",
            quantity_per_unit: 0.5,
            cooking_measurement_id: "cm-1",
          },
          { ingredient_menu_id: "menu-sambal", quantity_per_unit: 20 },
        ],
      }),
    );
  });

  it("normalizes menu reference ingredient responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          menu_id: "menu-dendeng",
          ingredients: [
            {
              food_supply_id: "supply-daging",
              food_supply_title: "Daging",
              unit: "gr",
              quantity_per_unit: "2000",
              current_stock_quantity: "10000",
            },
            {
              ingredient_menu_id: "menu-sambal",
              ingredient_menu_title: "Sambal Merah",
              quantity_per_unit: "20",
            },
          ],
        },
      }),
    );

    const result = await getMenuIngredients("menu-dendeng");

    expect(result.data.ingredients).toEqual([
      {
        food_supply_id: "supply-daging",
        food_supply_title: "Daging",
        food_supply_unit: "gr",
        quantity_per_unit: 2000,
        food_supply_stock_quantity: 10000,
      },
      {
        ingredient_menu_id: "menu-sambal",
        ingredient_menu_title: "Sambal Merah",
        quantity_per_unit: 20,
      },
    ]);
  });
});
