import { describe, it, expect } from "vitest";
import { cn, formatDate, formatRupiah, formatStockQuantity, displayDescription, menuPhotoUrl, initials } from "./utils";
import { config } from "./config";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("resolves conflicting tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("handles conditional values", () => {
    expect(cn("a", false && "b", null, undefined, "c")).toBe("a c");
  });
});

describe("formatDate", () => {
  it("formats an ISO string", () => {
    expect(formatDate("2024-01-15T00:00:00Z")).toMatch(/2024/);
  });

  it("returns a dash for invalid input", () => {
    expect(formatDate("not-a-date")).toBe("—");
  });
});

describe("formatStockQuantity", () => {
  it("formats whole numbers without trailing zeros", () => {
    expect(formatStockQuantity(500, "ml")).toBe("500 ml");
  });

  it("preserves meaningful decimals", () => {
    expect(formatStockQuantity(2.5, "gr")).toBe("2.5 gr");
  });

  it("strips unnecessary trailing zeros", () => {
    expect(formatStockQuantity(500.0, "ml")).toBe("500 ml");
    expect(formatStockQuantity(2.5, "piece")).toBe("2.5 piece");
  });

  it("formats string whole numbers", () => {
    expect(formatStockQuantity("500", "ml")).toBe("500 ml");
  });

  it("formats string decimals", () => {
    expect(formatStockQuantity("2.5", "gr")).toBe("2.5 gr");
  });

  it("returns an em dash for invalid string input", () => {
    expect(formatStockQuantity("abc", "ml")).toBe("— ml");
  });
});

describe("displayDescription", () => {
  it("returns an em dash for empty values", () => {
    expect(displayDescription(null)).toBe("—");
    expect(displayDescription("")).toBe("—");
    expect(displayDescription("   ")).toBe("—");
  });

  it("returns short text unchanged", () => {
    expect(displayDescription("Extra virgin")).toBe("Extra virgin");
  });

  it("truncates long text", () => {
    const long = "a".repeat(100);
    expect(displayDescription(long)).toBe(`${"a".repeat(80)}…`);
  });
});

describe("formatRupiah", () => {
  it("formats amounts with Indonesian grouping and no decimals", () => {
    expect(formatRupiah(35000)).toBe("Rp 35.000");
    expect(formatRupiah(25000)).toBe("Rp 25.000");
  });
});

describe("menuPhotoUrl", () => {
  it("returns the default food photo when empty", () => {
    expect(menuPhotoUrl(null)).toBe("/default-food.svg");
    expect(menuPhotoUrl("")).toBe("/default-food.svg");
    expect(menuPhotoUrl("   ")).toBe("/default-food.svg");
  });

  it("returns a trimmed custom photo URL when provided", () => {
    expect(menuPhotoUrl(" https://example.com/food.jpg ")).toBe(
      "https://example.com/food.jpg",
    );
  });

  it("prefixes API-hosted static paths with the API base URL", () => {
    expect(menuPhotoUrl("/static/uploads/menus/x.webp")).toBe(
      `${config.apiBaseUrl}/static/uploads/menus/x.webp`,
    );
  });
});

describe("initials", () => {
  it("returns up to two uppercase initials", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
  });

  it("handles a single name", () => {
    expect(initials("Madonna")).toBe("M");
  });

  it("ignores extra words", () => {
    expect(initials("John Ronald Reuel Tolkien")).toBe("JR");
  });
});
