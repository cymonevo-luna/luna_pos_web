import { describe, it, expect } from "vitest";
import {
  applySupplierQuoteToItem,
  buildBatchPurchasePayload,
  effectiveLineAmount,
  findSupplierQuote,
  groupWizardItemsBySupplier,
  supplierOptionsForItem,
  allItemsHaveSupplier,
  type SmartPurchaseWizardItem,
} from "./smart-purchase-utils";

const baseItem: SmartPurchaseWizardItem = {
  food_supply_id: "fs-rice",
  food_supply_title: "Rice",
  quantity: 2,
  unit: "gr",
  has_supplier_price: true,
  selected_supplier_id: "sup-cheap",
  selected_supplier_name: "Cheap Supplier",
  price_amount: 100000,
  price_quantity: 1000,
  unit_price: 100,
  line_estimated_amount: 200,
  all_supplier_quotes: [
    {
      supplier_id: "sup-cheap",
      supplier_name: "Cheap Supplier",
      price_amount: 100000,
      price_quantity: 1000,
      unit_price: 100,
    },
    {
      supplier_id: "sup-expensive",
      supplier_name: "Expensive Supplier",
      price_amount: 150000,
      price_quantity: 1000,
      unit_price: 150,
    },
  ],
};

describe("findSupplierQuote", () => {
  it("returns a quote from all_supplier_quotes", () => {
    const quote = findSupplierQuote("sup-expensive", baseItem);
    expect(quote?.supplier_name).toBe("Expensive Supplier");
  });

  it("returns a quote from manual supplier prices", () => {
    const item: SmartPurchaseWizardItem = {
      ...baseItem,
      has_supplier_price: false,
      selected_supplier_id: null,
      all_supplier_quotes: [],
      manual_supplier_prices: [
        {
          id: "price-1",
          supplier_id: "sup-manual",
          supplier_name: "Manual Supplier",
          food_supply_id: "fs-rice",
          unit: "gr",
          price_amount: 120000,
          price_quantity: 1000,
        },
      ],
    };

    const quote = findSupplierQuote("sup-manual", item);
    expect(quote?.supplier_name).toBe("Manual Supplier");
    expect(quote?.unit_price).toBe(120);
  });
});

describe("applySupplierQuoteToItem", () => {
  it("recalculates line total when supplier changes", () => {
    const quote = baseItem.all_supplier_quotes[1]!;
    const updated = applySupplierQuoteToItem(baseItem, quote);

    expect(updated.selected_supplier_id).toBe("sup-expensive");
    expect(updated.line_estimated_amount).toBe(300);
  });

  it("resets catalog update fields to the newly selected quote defaults", () => {
    const itemWithCatalogEdits: SmartPurchaseWizardItem = {
      ...baseItem,
      update_catalog_price: true,
      catalog_price_amount: 99999,
      catalog_price_quantity: 500,
    };
    const quote = baseItem.all_supplier_quotes[1]!;
    const updated = applySupplierQuoteToItem(itemWithCatalogEdits, quote);

    expect(updated.update_catalog_price).toBe(false);
    expect(updated.catalog_price_amount).toBe(quote.price_amount);
    expect(updated.catalog_price_quantity).toBe(quote.price_quantity);
  });
});

describe("effectiveLineAmount", () => {
  it("uses actual price when provided", () => {
    expect(
      effectiveLineAmount({ ...baseItem, line_actual_amount: 175 }),
    ).toBe(175);
  });

  it("falls back to estimate when actual price is not set", () => {
    expect(effectiveLineAmount(baseItem)).toBe(200);
  });
});

describe("groupWizardItemsBySupplier", () => {
  it("groups items by selected supplier and totals each group", () => {
    const secondItem: SmartPurchaseWizardItem = {
      ...baseItem,
      food_supply_id: "fs-salt",
      food_supply_title: "Salt",
      selected_supplier_id: "sup-expensive",
      selected_supplier_name: "Expensive Supplier",
      price_amount: 5000,
      price_quantity: 1000,
      unit_price: 5,
      line_estimated_amount: 10,
    };

    const groups = groupWizardItemsBySupplier([baseItem, secondItem]);

    expect(groups).toHaveLength(2);
    expect(groups.find((group) => group.supplier_id === "sup-cheap")?.items).toHaveLength(1);
    expect(groups.find((group) => group.supplier_id === "sup-expensive")?.items).toHaveLength(1);
    expect(
      groups.find((group) => group.supplier_id === "sup-expensive")
        ?.group_total_estimated_amount,
    ).toBe(10);
  });

  it("moves an item to a new group after supplier override", () => {
    const updated = applySupplierQuoteToItem(
      baseItem,
      baseItem.all_supplier_quotes[1]!,
    );
    const groups = groupWizardItemsBySupplier([updated]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.supplier_id).toBe("sup-expensive");
    expect(groups[0]?.group_total_estimated_amount).toBe(300);
  });

  it("uses actual prices in group totals when provided", () => {
    const itemWithActual: SmartPurchaseWizardItem = {
      ...baseItem,
      line_actual_amount: 175,
    };
    const groups = groupWizardItemsBySupplier([itemWithActual]);

    expect(groups[0]?.group_total_estimated_amount).toBe(175);
  });
});

describe("buildBatchPurchasePayload", () => {
  it("builds groups without duplicate food supplies across groups", () => {
    const secondItem: SmartPurchaseWizardItem = {
      ...baseItem,
      food_supply_id: "fs-salt",
      food_supply_title: "Salt",
      selected_supplier_id: "sup-cheap",
      line_estimated_amount: 50,
    };

    const payload = buildBatchPurchasePayload([baseItem, secondItem], "Urgent");

    expect(payload).toEqual({
      notes: "Urgent",
      groups: [
        {
          supplier_id: "sup-cheap",
          items: [
            { food_supply_id: "fs-rice", quantity: "2" },
            { food_supply_id: "fs-salt", quantity: "2" },
          ],
        },
      ],
    });
  });

  it("includes optional actual and catalog fields only when filled", () => {
    const itemWithActual: SmartPurchaseWizardItem = {
      ...baseItem,
      line_actual_amount: 175,
      update_catalog_price: true,
      catalog_price_amount: 110000,
      catalog_price_quantity: 1000,
    };

    const payload = buildBatchPurchasePayload([itemWithActual]);

    expect(payload.groups[0]?.items[0]).toEqual({
      food_supply_id: "fs-rice",
      quantity: "2",
      line_actual_amount: "175",
      supplier_price_update: {
        price_amount: "110000",
        price_quantity: "1000",
      },
    });
  });

  it("omits supplier_price_update when catalog update is disabled", () => {
    const itemWithActualOnly: SmartPurchaseWizardItem = {
      ...baseItem,
      line_actual_amount: 180,
      update_catalog_price: false,
    };

    const payload = buildBatchPurchasePayload([itemWithActualOnly]);

    expect(payload.groups[0]?.items[0]).toEqual({
      food_supply_id: "fs-rice",
      quantity: "2",
      line_actual_amount: "180",
    });
  });
});

describe("allItemsHaveSupplier", () => {
  it("returns false when any item lacks a supplier", () => {
    expect(
      allItemsHaveSupplier([
        baseItem,
        { ...baseItem, food_supply_id: "fs-2", selected_supplier_id: null },
      ]),
    ).toBe(false);
  });
});

describe("supplierOptionsForItem", () => {
  it("merges suggest quotes and manual prices", () => {
    const item: SmartPurchaseWizardItem = {
      ...baseItem,
      all_supplier_quotes: [],
      manual_supplier_prices: [
        {
          id: "price-1",
          supplier_id: "sup-manual",
          supplier_name: "Manual Supplier",
          food_supply_id: "fs-rice",
          unit: "gr",
          price_amount: 120000,
          price_quantity: 1000,
        },
      ],
    };

    expect(supplierOptionsForItem(item)).toHaveLength(1);
  });
});
