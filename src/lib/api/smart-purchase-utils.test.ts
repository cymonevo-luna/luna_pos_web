import { describe, it, expect } from "vitest";
import {
  applySupplierQuoteToItem,
  buildBatchPurchasePayload,
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
