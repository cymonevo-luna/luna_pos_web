import { describe, it, expect } from "vitest";
import {
  MENU_INGREDIENT_QUANTITY_HELP,
  MENU_COGS_DEFAULTS,
  quantityPerPortion,
} from "./menu-cogs";

describe("menu-cogs", () => {
  it("defines COGS defaults", () => {
    expect(MENU_COGS_DEFAULTS).toEqual({
      recipe_yield: 1,
      margin_percent: 0,
      vat_percent: 0,
    });
  });

  it("computes quantity per portion", () => {
    expect(quantityPerPortion(2000, 40)).toBe(50);
  });

  it("returns null for invalid yield or quantity", () => {
    expect(quantityPerPortion(2000, 0)).toBeNull();
    expect(quantityPerPortion(Number.NaN, 40)).toBeNull();
  });

  it("documents batch ingredient quantities", () => {
    expect(MENU_INGREDIENT_QUANTITY_HELP).toContain("full recipe yield batch");
    expect(MENU_INGREDIENT_QUANTITY_HELP).toContain("when yield > 1");
  });
});
