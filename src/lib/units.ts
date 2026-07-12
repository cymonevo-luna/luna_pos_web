import type { FoodSupplyUnit } from "@/lib/api/types";

export const FOOD_SUPPLY_UNIT_LABELS: Record<FoodSupplyUnit, string> = {
  ml: "ml",
  gr: "gr",
  piece: "pcs",
};

export const UNIT_OPTIONS = [
  { value: "ml" as const, label: FOOD_SUPPLY_UNIT_LABELS.ml },
  { value: "gr" as const, label: FOOD_SUPPLY_UNIT_LABELS.gr },
  { value: "piece" as const, label: FOOD_SUPPLY_UNIT_LABELS.piece },
] as const;

const CONVERTED_UNIT_SUFFIX: Partial<Record<FoodSupplyUnit, string>> = {
  gr: "kg",
  ml: "ltr",
};

const CONVERSION_THRESHOLD = 1000;

function formatNumericQuantity(value: number) {
  return Number.parseFloat(value.toFixed(10)).toString();
}

/** Map API unit values to user-facing labels (e.g. piece → pcs). */
export function getUnitLabel(unit: FoodSupplyUnit | string): string {
  if (unit === "ml" || unit === "gr" || unit === "piece") {
    return FOOD_SUPPLY_UNIT_LABELS[unit];
  }
  return unit;
}

/**
 * Format a measurement quantity for display, auto-converting gr/ml at ≥ 1000
 * to match backend rules (kg / ltr).
 */
export function formatMeasurementQuantity(
  quantity: number | string,
  unit: FoodSupplyUnit | string,
): string {
  const n = typeof quantity === "number" ? quantity : Number(quantity);
  if (!Number.isFinite(n)) {
    return `— ${getUnitLabel(unit)}`;
  }

  if (
    (unit === "gr" || unit === "ml") &&
    Math.abs(n) >= CONVERSION_THRESHOLD
  ) {
    const converted = n / CONVERSION_THRESHOLD;
    const suffix = CONVERTED_UNIT_SUFFIX[unit]!;
    return `${formatNumericQuantity(converted)} ${suffix}`;
  }

  return `${formatNumericQuantity(n)} ${getUnitLabel(unit)}`;
}
