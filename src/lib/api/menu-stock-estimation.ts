import { api, type ApiResult } from "./client";
import type {
  StockEstimationIngredient,
  StockEstimationResponse,
} from "./types";
import { parseStockQuantity } from "./food-supplies";

/** Wire format from the Go backend (`decimal.Decimal` marshals as JSON string). */
interface StockEstimationIngredientRaw
  extends Omit<
    StockEstimationIngredient,
    | "quantity_per_unit"
    | "required_quantity"
    | "current_stock_quantity"
    | "remaining_after"
  > {
  quantity_per_unit: number | string;
  required_quantity: number | string;
  current_stock_quantity: number | string;
  remaining_after: number | string;
}

interface StockEstimationResponseRaw
  extends Omit<StockEstimationResponse, "ingredients"> {
  ingredients?: StockEstimationIngredientRaw[];
}

function normalizeStockEstimationIngredient(
  raw: StockEstimationIngredientRaw,
): StockEstimationIngredient {
  return {
    ...raw,
    quantity_per_unit: parseStockQuantity(raw.quantity_per_unit),
    required_quantity: parseStockQuantity(raw.required_quantity),
    current_stock_quantity: parseStockQuantity(raw.current_stock_quantity),
    remaining_after: parseStockQuantity(raw.remaining_after),
  };
}

function normalizeStockEstimationResponse(
  raw: StockEstimationResponseRaw,
): StockEstimationResponse {
  return {
    ...raw,
    ingredients: raw.ingredients?.map(normalizeStockEstimationIngredient),
  };
}

function normalizeStockEstimationResult(
  result: ApiResult<StockEstimationResponseRaw>,
): ApiResult<StockEstimationResponse> {
  return {
    ...result,
    data: normalizeStockEstimationResponse(result.data),
  };
}

export async function getMenuStockEstimation(menuId: string, quantity: number) {
  const result = await api.get<StockEstimationResponseRaw>(
    `/api/admin/menus/${menuId}/stock-estimation?quantity=${quantity}`,
  );
  return normalizeStockEstimationResult(result);
}
