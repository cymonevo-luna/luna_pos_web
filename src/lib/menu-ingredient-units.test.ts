import { describe, it, expect } from "vitest";
import {
  BASE_UNIT_SELECTION,
  buildUnitOptions,
  computeBaseQuantityHint,
  getIngredientDisplayQuantity,
  getIngredientUnitSelection,
  getSelectedUnitLabel,
  hasCookingUnitOptions,
} from "./menu-ingredient-units";
import type { MenuIngredient } from "@/lib/api/types";

const cookingMeasurements = [
  { id: "cm-1", name: "Tablespoon", conversion_quantity: "10" },
  { id: "cm-2", name: "Teaspoon", conversion_quantity: "3.33" },
];

describe("menu-ingredient-units", () => {
  it("builds unit options with base unit first", () => {
    expect(buildUnitOptions("gr", cookingMeasurements)).toEqual([
      { value: BASE_UNIT_SELECTION, label: "gr" },
      { value: "cm-1", label: "Tablespoon" },
      { value: "cm-2", label: "Teaspoon" },
    ]);
  });

  it("detects when cooking unit options exist", () => {
    expect(hasCookingUnitOptions([])).toBe(false);
    expect(hasCookingUnitOptions(cookingMeasurements)).toBe(true);
  });

  it("uses entry_quantity when a cooking measurement is selected", () => {
    const ingredient: MenuIngredient = {
      food_supply_id: "supply-1",
      quantity_per_unit: 5,
      entry_quantity: 0.5,
      cooking_measurement_id: "cm-1",
      cooking_measurement_name: "Tablespoon",
      food_supply_title: "Salt",
      food_supply_unit: "gr",
      food_supply_stock_quantity: 100,
    };

    expect(getIngredientDisplayQuantity(ingredient)).toBe("0.5");
    expect(getIngredientUnitSelection(ingredient)).toBe("cm-1");
  });

  it("uses base quantity when no cooking measurement is selected", () => {
    const ingredient: MenuIngredient = {
      food_supply_id: "supply-1",
      quantity_per_unit: 200,
      food_supply_title: "Rice",
      food_supply_unit: "gr",
      food_supply_stock_quantity: 1000,
    };

    expect(getIngredientDisplayQuantity(ingredient)).toBe("200");
    expect(getIngredientUnitSelection(ingredient)).toBe(BASE_UNIT_SELECTION);
  });

  it("returns the selected unit label", () => {
    expect(getSelectedUnitLabel(BASE_UNIT_SELECTION, "gr", cookingMeasurements)).toBe(
      "gr",
    );
    expect(getSelectedUnitLabel("cm-1", "gr", cookingMeasurements)).toBe(
      "Tablespoon",
    );
  });

  it("computes base quantity hint for cooking units", () => {
    expect(
      computeBaseQuantityHint(0.5, "cm-1", cookingMeasurements, "gr"),
    ).toBe("= 5 gr");
    expect(
      computeBaseQuantityHint(5, BASE_UNIT_SELECTION, cookingMeasurements, "gr"),
    ).toBeNull();
  });
});
