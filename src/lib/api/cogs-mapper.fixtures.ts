import type {
  CogsMenuDetailRaw,
  CogsMenuSummaryRaw,
  CogsPortfolioSummaryRaw,
} from "./cogs-mapper";

/** Backend-shaped summary from luna_pos_service `cogs.SummaryResponse`. */
export const backendSummaryFixture: CogsMenuSummaryRaw = {
  menu_id: "menu-rendang-uuid",
  menu_title: "Rendang",
  category_name: "Main",
  recipe_yield: 40,
  cogs_per_piece: 15000,
  margin_percent: "30",
  vat_percent: "11",
  price_after_margin: 19500,
  price_after_vat: 21645,
  recommended_offline_price: 22000,
  recommended_online_price: 26400,
  current_sell_price: 25000,
  completeness: "complete",
};

/** Backend-shaped detail from luna_pos_service `cogs.DetailResponse`. */
export const backendDetailFixture: CogsMenuDetailRaw = {
  ...backendSummaryFixture,
  recipe_yield: 40,
  ingredients: [
    {
      food_supply_title: "Beef Chuck",
      quantity_for_batch: "1000",
      quantity_per_piece: "25",
      unit: "gr",
      selected_supplier_name: "Premium Meats",
      selected_unit_price: "120000",
      line_cost: 3000,
      price_status: "priced",
      all_supplier_quotes: [
        {
          supplier_id: "sup-local",
          supplier_name: "Local Market",
          unit_price: "100000",
        },
        {
          supplier_id: "sup-premium",
          supplier_name: "Premium Meats",
          unit_price: "120000",
        },
      ],
    },
    {
      food_supply_title: "Coconut Milk",
      quantity_for_batch: "2000",
      quantity_per_piece: "50",
      unit: "ml",
      selected_supplier_name: "Coco Farm",
      selected_unit_price: "18.5",
      line_cost: 925,
      price_status: "priced",
      all_supplier_quotes: [
        {
          supplier_id: "sup-coco",
          supplier_name: "Coco Farm",
          unit_price: "18.5",
        },
      ],
    },
  ],
};

/** Backend-shaped portfolio summary from luna_pos_service `cogs.PortfolioSummaryResponse`. */
export const backendPortfolioSummaryFixture: CogsPortfolioSummaryRaw = {
  generated_at: "2026-07-18T03:00:00.000Z",
  total_menus: 5,
  complete_count: 3,
  missing_prices_count: 1,
  no_formula_count: 1,
  avg_margin_percent: "28.5",
  avg_cogs_per_piece: 12500,
  variance: {
    total_recommended_sell_price: 110000,
    total_current_sell_price: 125000,
    variance_amount: -15000,
    variance_percent: "-12",
  },
  categories: [
    {
      category_id: "cat-main",
      category_name: "Main",
      menu_count: 3,
      complete_count: 2,
      avg_margin_percent: "30",
      avg_cogs_per_piece: 15000,
    },
    {
      category_id: "cat-drinks",
      category_name: "Drinks",
      menu_count: 2,
      complete_count: 1,
      avg_margin_percent: "25",
      avg_cogs_per_piece: 8000,
    },
  ],
};
