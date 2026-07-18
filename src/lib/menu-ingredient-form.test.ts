import { describe, it, expect, beforeEach } from "vitest";
import {
  createBlankRow,
  ingredientToRow,
  mapServerFieldErrors,
  parsePositiveQuantity,
  resetRowKeyCounter,
  rowToPayload,
  rowsToPayload,
  validateRows,
  type IngredientRowState,
} from "./menu-ingredient-form";
import type { MenuIngredient } from "@/lib/api/types";

describe("menu-ingredient-form", () => {
  beforeEach(() => {
    resetRowKeyCounter();
  });

  describe("parsePositiveQuantity", () => {
    it("accepts positive numbers", () => {
      expect(parsePositiveQuantity("1.5")).toBe(1.5);
      expect(parsePositiveQuantity(" 20 ")).toBe(20);
    });

    it("rejects empty, zero, and invalid values", () => {
      expect(parsePositiveQuantity("")).toBeNull();
      expect(parsePositiveQuantity("0")).toBeNull();
      expect(parsePositiveQuantity("-1")).toBeNull();
      expect(parsePositiveQuantity("abc")).toBeNull();
    });
  });

  describe("ingredientToRow", () => {
    it("maps food supply ingredients", () => {
      const ingredient: MenuIngredient = {
        food_supply_id: "supply-1",
        quantity_per_unit: 100,
        food_supply_title: "Cabe",
        food_supply_unit: "gr",
        food_supply_stock_quantity: 5000,
      };

      const row = ingredientToRow(ingredient);

      expect(row.line_type).toBe("food_supply");
      expect(row.food_supply_id).toBe("supply-1");
      expect(row.quantity).toBe("100");
      expect(row.supply?.title).toBe("Cabe");
    });

    it("maps menu reference ingredients", () => {
      const ingredient: MenuIngredient = {
        ingredient_menu_id: "menu-sambal",
        ingredient_menu_title: "Sambal Merah",
        quantity_per_unit: 20,
      };

      const row = ingredientToRow(ingredient);

      expect(row.line_type).toBe("menu");
      expect(row.ingredient_menu_id).toBe("menu-sambal");
      expect(row.quantity).toBe("20");
      expect(row.menu?.title).toBe("Sambal Merah");
    });
  });

  describe("rowToPayload", () => {
    it("builds food supply payload without cooking measurement", () => {
      const row: IngredientRowState = {
        ...createBlankRow("food_supply"),
        food_supply_id: "supply-1",
        quantity: "2000",
      };

      expect(rowToPayload(row)).toEqual({
        food_supply_id: "supply-1",
        quantity_per_unit: 2000,
      });
    });

    it("builds food supply payload with cooking measurement", () => {
      const row: IngredientRowState = {
        ...createBlankRow("food_supply"),
        food_supply_id: "supply-2",
        quantity: "0.5",
        unit_selection: "cm-tbsp",
      };

      expect(rowToPayload(row)).toEqual({
        food_supply_id: "supply-2",
        quantity_per_unit: 0.5,
        cooking_measurement_id: "cm-tbsp",
      });
    });

    it("builds menu reference payload without cooking_measurement_id", () => {
      const row: IngredientRowState = {
        ...createBlankRow("menu"),
        ingredient_menu_id: "menu-sambal",
        quantity: "20",
      };

      expect(rowToPayload(row)).toEqual({
        ingredient_menu_id: "menu-sambal",
        quantity_per_unit: 20,
      });
    });
  });

  describe("rowsToPayload", () => {
    it("builds mixed formula payload", () => {
      const rows: IngredientRowState[] = [
        {
          ...createBlankRow("food_supply"),
          food_supply_id: "supply-daging",
          quantity: "2000",
        },
        {
          ...createBlankRow("menu"),
          ingredient_menu_id: "menu-sambal",
          quantity: "20",
        },
      ];

      expect(rowsToPayload(rows)).toEqual([
        { food_supply_id: "supply-daging", quantity_per_unit: 2000 },
        { ingredient_menu_id: "menu-sambal", quantity_per_unit: 20 },
      ]);
    });
  });

  describe("validateRows", () => {
    it("requires picker and positive quantity per row type", () => {
      const rows = [createBlankRow("food_supply"), createBlankRow("menu")];
      const errors = validateRows(rows);

      expect(errors[rows[0]!.key]?.food_supply_id).toBe("Select a food supply");
      expect(errors[rows[1]!.key]?.ingredient_menu_id).toBe("Select a menu");
      expect(errors[rows[0]!.key]?.quantity_per_unit).toBe(
        "Enter a quantity greater than 0",
      );
    });

    it("blocks duplicate food supplies and menus", () => {
      const rows: IngredientRowState[] = [
        {
          ...createBlankRow("food_supply"),
          food_supply_id: "supply-1",
          quantity: "1",
        },
        {
          ...createBlankRow("food_supply"),
          food_supply_id: "supply-1",
          quantity: "2",
        },
        {
          ...createBlankRow("menu"),
          ingredient_menu_id: "menu-1",
          quantity: "3",
        },
        {
          ...createBlankRow("menu"),
          ingredient_menu_id: "menu-1",
          quantity: "4",
        },
      ];

      const errors = validateRows(rows);

      expect(errors[rows[0]!.key]?.food_supply_id).toBe(
        "This food supply is already selected",
      );
      expect(errors[rows[1]!.key]?.food_supply_id).toBe(
        "This food supply is already selected",
      );
      expect(errors[rows[2]!.key]?.ingredient_menu_id).toBe(
        "This menu is already selected",
      );
      expect(errors[rows[3]!.key]?.ingredient_menu_id).toBe(
        "This menu is already selected",
      );
    });
  });

  describe("mapServerFieldErrors", () => {
    it("maps ingredient_menu_id field errors to stable row keys", () => {
      const rows: IngredientRowState[] = [
        {
          ...createBlankRow("menu"),
          ingredient_menu_id: "menu-a",
          quantity: "1",
        },
      ];

      const { rowErrors, generalError } = mapServerFieldErrors(
        {
          "ingredients[0].ingredient_menu_id":
            "Circular reference detected in menu ingredients",
        },
        rows,
      );

      expect(rowErrors[rows[0]!.key]?.ingredient_menu_id).toBe(
        "Circular reference detected in menu ingredients",
      );
      expect(generalError).toBeNull();
    });

    it("maps general ingredients errors", () => {
      const rows = [createBlankRow("food_supply")];
      const { generalError } = mapServerFieldErrors(
        { ingredients: "Formula is invalid" },
        rows,
      );

      expect(generalError).toBe("Formula is invalid");
    });
  });
});
