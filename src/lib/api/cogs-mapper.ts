import { parseNumeric } from "./suppliers";
import type {
  CogsIngredientBreakdown,
  CogsMenuDetail,
  CogsMenuSummary,
  CogsStatus,
  CogsSupplierQuote,
  FoodSupplyUnit,
} from "./types";

/** Wire format from the Go backend (`decimal.Decimal` marshals as JSON string). */
export interface CogsSupplierQuoteRaw {
  supplier_id: string;
  supplier_name: string;
  unit_price: number | string;
  selected?: boolean;
}

export interface CogsIngredientBreakdownRaw {
  food_supply_id?: string;
  food_supply_title: string;
  quantity_for_batch?: number | string;
  quantity_batch?: number | string;
  quantity_per_piece: number | string;
  unit: FoodSupplyUnit;
  selected_supplier_id?: string | null;
  selected_supplier_name?: string | null;
  selected_unit_price?: number | string | null;
  all_supplier_quotes?: CogsSupplierQuoteRaw[];
  supplier_quotes?: CogsSupplierQuoteRaw[];
  line_cost?: number | string | null;
  price_status?: string;
}

export interface CogsMenuSummaryRaw {
  menu_id: string;
  menu_title?: string;
  title?: string;
  category_id?: string;
  category_name: string;
  recipe_yield?: number;
  cogs_per_piece?: number | string | null;
  margin_percent: number | string;
  vat_percent: number | string;
  price_after_margin?: number | string | null;
  price_after_vat?: number | string | null;
  recommended_offline_price?: number | string | null;
  recommended_online_price?: number | string | null;
  recommended_offline?: number | string | null;
  recommended_online?: number | string | null;
  current_sell_price?: number | string;
  sell_price?: number | string;
  completeness?: CogsStatus;
  status?: CogsStatus;
}

export interface CogsMenuDetailRaw extends CogsMenuSummaryRaw {
  recipe_yield: number;
  ingredients?: CogsIngredientBreakdownRaw[];
  total_cogs?: number | string | null;
}

function parseNullableNumeric(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function normalizeSupplierQuotes(
  rawQuotes: CogsSupplierQuoteRaw[] | undefined,
  selectedSupplierName: string | null | undefined,
  selectedUnitPrice: number | null,
): CogsSupplierQuote[] {
  const quotes: CogsSupplierQuote[] = (rawQuotes ?? []).map((quote) => ({
    supplier_id: quote.supplier_id,
    supplier_name: quote.supplier_name,
    unit_price: parseNumeric(quote.unit_price),
    selected: false,
  }));

  if (quotes.length === 0) return quotes;

  const matchedBySelection = quotes.filter(
    (quote) =>
      selectedSupplierName &&
      selectedUnitPrice != null &&
      quote.supplier_name === selectedSupplierName &&
      quote.unit_price === selectedUnitPrice,
  );

  if (matchedBySelection.length === 1) {
    matchedBySelection[0]!.selected = true;
    return quotes;
  }

  const maxPrice = Math.max(...quotes.map((quote) => quote.unit_price));
  const firstHighest = quotes.find((quote) => quote.unit_price === maxPrice);
  if (firstHighest) {
    firstHighest.selected = true;
  }

  return quotes;
}

function deriveFoodSupplyId(
  raw: CogsIngredientBreakdownRaw,
  selectedQuote: CogsSupplierQuote | undefined,
): string {
  if (raw.food_supply_id) return raw.food_supply_id;
  if (selectedQuote?.supplier_id) return selectedQuote.supplier_id;
  return slugifyTitle(raw.food_supply_title ?? "");
}

export function normalizeCogsIngredient(
  raw: CogsIngredientBreakdownRaw,
): CogsIngredientBreakdown {
  const selectedUnitPrice = parseNullableNumeric(raw.selected_unit_price);
  const supplierQuotes = normalizeSupplierQuotes(
    raw.all_supplier_quotes ?? raw.supplier_quotes,
    raw.selected_supplier_name,
    selectedUnitPrice,
  );
  const selectedQuote = supplierQuotes.find((quote) => quote.selected);

  return {
    food_supply_id: deriveFoodSupplyId(raw, selectedQuote),
    food_supply_title: raw.food_supply_title,
    quantity_batch: parseNumeric(raw.quantity_for_batch ?? raw.quantity_batch),
    quantity_per_piece: parseNumeric(raw.quantity_per_piece),
    unit: raw.unit,
    selected_supplier_id:
      raw.selected_supplier_id ?? selectedQuote?.supplier_id ?? null,
    selected_supplier_name:
      raw.selected_supplier_name ?? selectedQuote?.supplier_name ?? null,
    selected_unit_price: selectedUnitPrice,
    supplier_quotes: supplierQuotes,
    line_cost: parseNullableNumeric(raw.line_cost),
  };
}

function computeTotalCogs(
  cogsPerPiece: number | null,
  recipeYield: number | undefined,
): number | null {
  if (cogsPerPiece == null || recipeYield == null) return null;
  return cogsPerPiece * recipeYield;
}

export function normalizeCogsMenuSummary(
  raw: CogsMenuSummaryRaw,
): CogsMenuSummary {
  return {
    menu_id: raw.menu_id,
    title: raw.menu_title ?? raw.title ?? "",
    category_id: raw.category_id ?? "",
    category_name: raw.category_name,
    cogs_per_piece: parseNullableNumeric(raw.cogs_per_piece),
    margin_percent: parseNumeric(raw.margin_percent),
    vat_percent: parseNumeric(raw.vat_percent),
    price_after_margin: parseNullableNumeric(raw.price_after_margin),
    price_after_vat: parseNullableNumeric(raw.price_after_vat),
    recommended_offline: parseNullableNumeric(
      raw.recommended_offline_price ?? raw.recommended_offline,
    ),
    recommended_online: parseNullableNumeric(
      raw.recommended_online_price ?? raw.recommended_online,
    ),
    sell_price: parseNumeric(raw.current_sell_price ?? raw.sell_price),
    status: raw.completeness ?? raw.status ?? "no_formula",
  };
}

export function normalizeCogsMenuDetail(
  raw: CogsMenuDetailRaw,
): CogsMenuDetail {
  const summary = normalizeCogsMenuSummary(raw);

  return {
    ...summary,
    recipe_yield: raw.recipe_yield,
    ingredients: (raw.ingredients ?? []).map(normalizeCogsIngredient),
    total_cogs: computeTotalCogs(summary.cogs_per_piece, raw.recipe_yield),
  };
}
