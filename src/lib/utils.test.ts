import { describe, it, expect } from "vitest";
import {
  cn,
  formatDate,
  formatRupiah,
  formatStockQuantity,
  displayDescription,
  menuPhotoUrl,
  initials,
  computeSupplierUnitPrice,
  formatSupplierUnitPrice,
  estimateLineAmount,
  extractWhatsAppPhone,
  buildPurchaseWhatsAppMessage,
} from "./utils";
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
    expect(formatStockQuantity(2.5, "piece")).toBe("2.5 pcs");
  });

  it("auto-converts grams and milliliters at or above 1000", () => {
    expect(formatStockQuantity(1000, "gr")).toBe("1 kg");
    expect(formatStockQuantity(1000, "ml")).toBe("1 ltr");
    expect(formatStockQuantity(2000, "gr")).toBe("2 kg");
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

describe("extractWhatsAppPhone", () => {
  it("converts Indonesian mobile numbers starting with 08 to 62 format", () => {
    expect(extractWhatsAppPhone("08123456789")).toBe("628123456789");
    expect(extractWhatsAppPhone("0812-3456-789")).toBe("628123456789");
  });

  it("keeps numbers that already use the 62 country code", () => {
    expect(extractWhatsAppPhone("628123456789")).toBe("628123456789");
    expect(extractWhatsAppPhone("+62 812 3456 789")).toBe("628123456789");
  });

  it("returns null when contact info has no plausible phone", () => {
    expect(extractWhatsAppPhone("supplier@example.com")).toBeNull();
    expect(extractWhatsAppPhone("")).toBeNull();
    expect(extractWhatsAppPhone("   ")).toBeNull();
  });
});

describe("buildPurchaseWhatsAppMessage", () => {
  it("builds an Indonesian order template with items and total", () => {
    const message = buildPurchaseWhatsAppMessage({
      id: "pr-1",
      supplier_id: "sup-1",
      supplier_name: "Beras Supplier",
      supplier_contact_info: "08123456789",
      status: "PENDING",
      items: [
        {
          id: "item-1",
          food_supply_id: "fs-1",
          food_supply_title: "Beras",
          unit: "gr",
          quantity: 2,
          price_quantity: 1000,
          unit_price: 140,
          price_amount: 280,
        },
      ],
      total_amount: 280,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });

    expect(message).toContain("Halo Beras Supplier,");
    expect(message).toContain("1. 2 gr Beras");
    expect(message).toContain("Estimasi total: Rp 280");
    expect(message).toContain("Terima kasih.");
  });

  it("uses converted quantities in line items", () => {
    const message = buildPurchaseWhatsAppMessage({
      id: "pr-2",
      supplier_id: "sup-1",
      supplier_name: "Beras Supplier",
      supplier_contact_info: "08123456789",
      status: "PENDING",
      items: [
        {
          id: "item-1",
          food_supply_id: "fs-1",
          food_supply_title: "Beras",
          unit: "gr",
          quantity: 2000,
          price_quantity: 1000,
          unit_price: 140,
          price_amount: 280000,
        },
      ],
      total_amount: 280000,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });

    expect(message).toContain("1. 2 kg Beras");
    expect(message).not.toContain("2000 gr");
  });
});

describe("computeSupplierUnitPrice", () => {
  it("computes price_amount divided by price_quantity", () => {
    expect(computeSupplierUnitPrice(140000, 1000)).toBe(140);
  });

  it("returns null for invalid quantities", () => {
    expect(computeSupplierUnitPrice(140000, 0)).toBeNull();
  });
});

describe("formatSupplierUnitPrice", () => {
  it("formats computed unit price with unit suffix", () => {
    expect(formatSupplierUnitPrice(140000, 1000, "gr")).toBe("Rp 140 / gr");
  });
});

describe("estimateLineAmount", () => {
  it("computes line total with half-up rounding", () => {
    expect(estimateLineAmount(140000, 1000, 1000)).toBe(140000);
    expect(estimateLineAmount(140000, 1000, 2)).toBe(280);
  });

  it("returns zero for invalid inputs", () => {
    expect(estimateLineAmount(140000, 0, 1000)).toBe(0);
    expect(estimateLineAmount(140000, 1000, 0)).toBe(0);
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
