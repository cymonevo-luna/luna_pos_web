/** Help text shown above ingredient quantity inputs in the menu formula section. */
export const MENU_INGREDIENT_QUANTITY_HELP =
  "Quantities are for the full recipe yield batch, not per single portion (when yield > 1).";

/** Default COGS field values for menus without explicit backend values. */
export const MENU_COGS_DEFAULTS = {
  recipe_yield: 1,
  margin_percent: 0,
  vat_percent: 0,
} as const;

/** Compute per-portion quantity from a batch quantity and recipe yield. */
export function quantityPerPortion(quantity: number, recipeYield: number) {
  if (!Number.isFinite(quantity) || recipeYield < 1) {
    return null;
  }
  return quantity / recipeYield;
}
