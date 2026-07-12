import type { FoodSupplyUnit } from "@/lib/api/types";

/** Short display labels for food supply units (API value `piece` shows as `pcs`). */
export const UNIT_DISPLAY_LABELS: Record<FoodSupplyUnit, string> = {
  ml: "ml",
  gr: "gr",
  piece: "pcs",
};

export const UNIT_OPTIONS = [
  { value: "ml" as const, label: UNIT_DISPLAY_LABELS.ml },
  { value: "gr" as const, label: UNIT_DISPLAY_LABELS.gr },
  { value: "piece" as const, label: UNIT_DISPLAY_LABELS.piece },
] as const;

export function formatUnitLabel(unit: FoodSupplyUnit): string {
  return UNIT_DISPLAY_LABELS[unit] ?? unit;
}
