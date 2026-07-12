import { describe, it, expect } from "vitest";
import {
  normalizeCogsIngredient,
  normalizeCogsMenuDetail,
  normalizeCogsMenuSummary,
} from "./cogs-mapper";
import {
  backendDetailFixture,
  backendSummaryFixture,
} from "./cogs-mapper.fixtures";

describe("normalizeCogsMenuSummary", () => {
  it("maps backend summary fields to frontend CogsMenuSummary", () => {
    expect(normalizeCogsMenuSummary(backendSummaryFixture)).toEqual({
      menu_id: "menu-rendang-uuid",
      title: "Rendang",
      category_id: "",
      category_name: "Main",
      cogs_per_piece: 15000,
      margin_percent: 30,
      vat_percent: 11,
      price_after_margin: 19500,
      price_after_vat: 21645,
      recommended_offline: 22000,
      recommended_online: 26400,
      sell_price: 25000,
      status: "complete",
    });
  });

  it("defaults category_id to empty string when absent", () => {
    const normalized = normalizeCogsMenuSummary(backendSummaryFixture);
    expect(normalized.category_id).toBe("");
  });

  it("coerces decimal string margin and vat to numbers", () => {
    const normalized = normalizeCogsMenuSummary({
      ...backendSummaryFixture,
      margin_percent: "20.5",
      vat_percent: "10",
    });
    expect(normalized.margin_percent).toBe(20.5);
    expect(normalized.vat_percent).toBe(10);
  });
});

describe("normalizeCogsIngredient", () => {
  it("maps all_supplier_quotes to supplier_quotes with numeric unit_price", () => {
    const [beef] = backendDetailFixture.ingredients!;
    const normalized = normalizeCogsIngredient(beef);

    expect(normalized.supplier_quotes).toHaveLength(2);
    expect(normalized.supplier_quotes[0]).toEqual({
      supplier_id: "sup-local",
      supplier_name: "Local Market",
      unit_price: 100000,
      selected: false,
    });
    expect(normalized.supplier_quotes[1]).toEqual({
      supplier_id: "sup-premium",
      supplier_name: "Premium Meats",
      unit_price: 120000,
      selected: true,
    });
  });

  it("maps quantity_for_batch to quantity_batch as a number", () => {
    const [beef] = backendDetailFixture.ingredients!;
    const normalized = normalizeCogsIngredient(beef);

    expect(normalized.quantity_batch).toBe(1000);
    expect(normalized.quantity_per_piece).toBe(25);
  });

  it("derives food_supply_id from selected quote supplier_id when absent", () => {
    const [beef] = backendDetailFixture.ingredients!;
    const normalized = normalizeCogsIngredient(beef);

    expect(normalized.food_supply_id).toBe("sup-premium");
  });

  it("derives food_supply_id from slugified title when no quotes match", () => {
    const normalized = normalizeCogsIngredient({
      food_supply_title: "Fresh Ginger",
      quantity_for_batch: "100",
      quantity_per_piece: "5",
      unit: "gr",
      selected_supplier_name: null,
      selected_unit_price: null,
      line_cost: null,
      all_supplier_quotes: [],
    });

    expect(normalized.food_supply_id).toBe("fresh-ginger");
    expect(normalized.supplier_quotes).toEqual([]);
  });

  it("selects highest unit_price when name+price match is ambiguous", () => {
    const normalized = normalizeCogsIngredient({
      food_supply_title: "Sugar",
      quantity_for_batch: "500",
      quantity_per_piece: "10",
      unit: "gr",
      selected_supplier_name: "Wholesale",
      selected_unit_price: "5000",
      line_cost: 500,
      all_supplier_quotes: [
        {
          supplier_id: "sup-a",
          supplier_name: "Wholesale",
          unit_price: "5000",
        },
        {
          supplier_id: "sup-b",
          supplier_name: "Wholesale",
          unit_price: "5000",
        },
        {
          supplier_id: "sup-c",
          supplier_name: "Retail",
          unit_price: "6000",
        },
      ],
    });

    expect(normalized.supplier_quotes.find((q) => q.selected)).toEqual({
      supplier_id: "sup-c",
      supplier_name: "Retail",
      unit_price: 6000,
      selected: true,
    });
  });

  it("parses selected_unit_price decimal string to number", () => {
    const [, coconut] = backendDetailFixture.ingredients!;
    const normalized = normalizeCogsIngredient(coconut);

    expect(normalized.selected_unit_price).toBe(18.5);
  });
});

describe("normalizeCogsMenuDetail", () => {
  it("maps backend detail to CogsMenuDetail with supplier_quotes arrays", () => {
    const normalized = normalizeCogsMenuDetail(backendDetailFixture);

    expect(normalized.title).toBe("Rendang");
    expect(normalized.status).toBe("complete");
    expect(normalized.recipe_yield).toBe(40);
    expect(normalized.ingredients).toHaveLength(2);
    expect(normalized.ingredients[0]!.supplier_quotes).toHaveLength(2);
    expect(normalized.ingredients[1]!.supplier_quotes).toHaveLength(1);
    expect(normalized.total_cogs).toBe(600000);
  });

  it("defaults ingredients to empty array when absent", () => {
    const normalized = normalizeCogsMenuDetail({
      ...backendSummaryFixture,
      recipe_yield: 10,
      completeness: "no_formula",
      cogs_per_piece: null,
    });

    expect(normalized.ingredients).toEqual([]);
    expect(normalized.status).toBe("no_formula");
    expect(normalized.total_cogs).toBeNull();
  });

  it("computes total_cogs as cogs_per_piece * recipe_yield", () => {
    const normalized = normalizeCogsMenuDetail({
      ...backendSummaryFixture,
      recipe_yield: 10,
      cogs_per_piece: 15000,
    });

    expect(normalized.total_cogs).toBe(150000);
  });
});
