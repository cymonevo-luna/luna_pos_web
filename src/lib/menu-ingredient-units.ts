import type { CookingMeasurement, FoodSupplyUnit, MenuIngredient } from "@/lib/api/types";
import { getUnitLabel } from "@/lib/units";
import { formatStockQuantity } from "@/lib/utils";

/** Sentinel value for the food supply base unit in the unit selector. */
export const BASE_UNIT_SELECTION = "base";

export function buildUnitOptions(
  baseUnit: FoodSupplyUnit,
  cookingMeasurements: CookingMeasurement[],
) {
  const options = [
    { value: BASE_UNIT_SELECTION, label: getUnitLabel(baseUnit) },
  ];
  for (const measurement of cookingMeasurements) {
    options.push({ value: measurement.id, label: measurement.name });
  }
  return options;
}

export function hasCookingUnitOptions(cookingMeasurements: CookingMeasurement[]) {
  return cookingMeasurements.length > 0;
}

export function getIngredientDisplayQuantity(ingredient: MenuIngredient): string {
  if (ingredient.cooking_measurement_id && ingredient.entry_quantity != null) {
    return String(ingredient.entry_quantity);
  }
  return String(ingredient.quantity_per_unit);
}

export function getIngredientUnitSelection(ingredient: MenuIngredient): string {
  return ingredient.cooking_measurement_id ?? BASE_UNIT_SELECTION;
}

export function getSelectedUnitLabel(
  unitSelection: string,
  baseUnit: FoodSupplyUnit,
  cookingMeasurements: CookingMeasurement[],
): string {
  if (unitSelection === BASE_UNIT_SELECTION) {
    return getUnitLabel(baseUnit);
  }
  return (
    cookingMeasurements.find((measurement) => measurement.id === unitSelection)
      ?.name ?? "—"
  );
}

export function computeBaseQuantityHint(
  quantity: number,
  unitSelection: string,
  cookingMeasurements: CookingMeasurement[],
  baseUnit: FoodSupplyUnit,
): string | null {
  if (unitSelection === BASE_UNIT_SELECTION) {
    return null;
  }

  const measurement = cookingMeasurements.find(
    (item) => item.id === unitSelection,
  );
  if (!measurement) {
    return null;
  }

  const conversion = Number(measurement.conversion_quantity);
  if (!Number.isFinite(conversion) || conversion <= 0) {
    return null;
  }

  return `= ${formatStockQuantity(quantity * conversion, baseUnit)}`;
}
