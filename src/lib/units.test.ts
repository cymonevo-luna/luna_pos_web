import { describe, it, expect } from "vitest";
import {
  FOOD_SUPPLY_UNIT_LABELS,
  UNIT_OPTIONS,
  formatMeasurementQuantity,
  getUnitLabel,
} from "./units";

describe("UNIT_OPTIONS", () => {
  it("exposes API values with short display labels", () => {
    expect(UNIT_OPTIONS).toEqual([
      { value: "ml", label: "ml" },
      { value: "gr", label: "gr" },
      { value: "piece", label: "pcs" },
    ]);
  });
});

describe("FOOD_SUPPLY_UNIT_LABELS", () => {
  it("maps API units to display labels", () => {
    expect(FOOD_SUPPLY_UNIT_LABELS).toEqual({
      ml: "ml",
      gr: "gr",
      piece: "pcs",
    });
  });
});

describe("getUnitLabel", () => {
  it("returns display labels for known units", () => {
    expect(getUnitLabel("piece")).toBe("pcs");
    expect(getUnitLabel("gr")).toBe("gr");
    expect(getUnitLabel("ml")).toBe("ml");
  });

  it("returns unknown units unchanged", () => {
    expect(getUnitLabel("kg")).toBe("kg");
  });
});

describe("formatMeasurementQuantity", () => {
  it("converts grams at the inclusive 1000 threshold to kg", () => {
    expect(formatMeasurementQuantity(1000, "gr")).toBe("1 kg");
    expect(formatMeasurementQuantity(2000, "gr")).toBe("2 kg");
  });

  it("converts milliliters at the inclusive 1000 threshold to ltr", () => {
    expect(formatMeasurementQuantity(1000, "ml")).toBe("1 ltr");
    expect(formatMeasurementQuantity(2500, "ml")).toBe("2.5 ltr");
  });

  it("keeps values below 1000 in base units", () => {
    expect(formatMeasurementQuantity(999, "gr")).toBe("999 gr");
    expect(formatMeasurementQuantity(500, "ml")).toBe("500 ml");
  });

  it("shows piece quantities as pcs without conversion", () => {
    expect(formatMeasurementQuantity(2.5, "piece")).toBe("2.5 pcs");
    expect(formatMeasurementQuantity(1000, "piece")).toBe("1000 pcs");
  });

  it("converts negative gram quantities using absolute threshold", () => {
    expect(formatMeasurementQuantity(-8000, "gr")).toBe("-8 kg");
  });

  it("formats string quantities", () => {
    expect(formatMeasurementQuantity("1000", "gr")).toBe("1 kg");
    expect(formatMeasurementQuantity("2.5", "piece")).toBe("2.5 pcs");
  });

  it("returns an em dash for invalid input", () => {
    expect(formatMeasurementQuantity("abc", "ml")).toBe("— ml");
    expect(formatMeasurementQuantity("abc", "piece")).toBe("— pcs");
  });

  it("strips unnecessary trailing zeros", () => {
    expect(formatMeasurementQuantity(500.0, "ml")).toBe("500 ml");
  });
});
