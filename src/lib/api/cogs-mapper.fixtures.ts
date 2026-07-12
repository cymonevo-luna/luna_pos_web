import type { CogsMenuDetailRaw, CogsMenuSummaryRaw } from "./cogs-mapper";

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
