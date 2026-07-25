import { describe, it, expect } from "vitest";
import {
  formatCogsMarginPercent,
  formatNullableCogsMarginPercent,
} from "./cogs-format";

describe("formatCogsMarginPercent", () => {
  it("formats integers with two decimal places", () => {
    expect(formatCogsMarginPercent(30)).toBe("30.00%");
  });

  it("formats one-decimal values with trailing zero", () => {
    expect(formatCogsMarginPercent(50.2)).toBe("50.20%");
  });

  it("rounds long precision to two decimal places", () => {
    expect(formatCogsMarginPercent(217.61006289308176)).toBe("217.61%");
  });

  it("rounds half-up at the third decimal", () => {
    expect(formatCogsMarginPercent(12.345)).toBe("12.35%");
    expect(formatCogsMarginPercent(12.344)).toBe("12.34%");
  });
});

describe("formatNullableCogsMarginPercent", () => {
  it("returns dash for null", () => {
    expect(formatNullableCogsMarginPercent(null)).toBe("—");
  });

  it("returns dash for undefined", () => {
    expect(formatNullableCogsMarginPercent(undefined)).toBe("—");
  });

  it("formats numeric values with two decimal places", () => {
    expect(formatNullableCogsMarginPercent(45)).toBe("45.00%");
    expect(formatNullableCogsMarginPercent(217.61006289308176)).toBe(
      "217.61%",
    );
  });
});
