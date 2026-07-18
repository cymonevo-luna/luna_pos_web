import { api, type ApiResult } from "./client";
import type {
  OrderOptionIngredient,
  OrderOptionIngredientInput,
  OrderOptionIngredientsResponse,
} from "./types";
import { parseStockQuantity } from "./food-supplies";

/** Wire format from the Go backend (`decimal.Decimal` marshals as JSON string). */
interface OrderOptionIngredientRaw
  extends Omit<OrderOptionIngredient, "quantity" | "current_stock_quantity"> {
  quantity: number | string;
  current_stock_quantity: number | string;
}

interface OrderOptionIngredientsResponseRaw
  extends Omit<OrderOptionIngredientsResponse, "ingredients"> {
  ingredients: OrderOptionIngredientRaw[];
}

function normalizeOrderOptionIngredient(
  raw: OrderOptionIngredientRaw,
): OrderOptionIngredient {
  return {
    ...raw,
    quantity: parseStockQuantity(raw.quantity),
    current_stock_quantity: parseStockQuantity(raw.current_stock_quantity),
  };
}

function normalizeOrderOptionIngredientsResponse(
  raw: OrderOptionIngredientsResponseRaw,
): OrderOptionIngredientsResponse {
  return {
    ...raw,
    ingredients: raw.ingredients.map(normalizeOrderOptionIngredient),
  };
}

function normalizeOrderOptionIngredientsResult(
  result: ApiResult<OrderOptionIngredientsResponseRaw>,
): ApiResult<OrderOptionIngredientsResponse> {
  return {
    ...result,
    data: normalizeOrderOptionIngredientsResponse(result.data),
  };
}

export async function getOrderOptionIngredients(orderOptionId: string) {
  const result = await api.get<OrderOptionIngredientsResponseRaw>(
    `/api/admin/order-options/${orderOptionId}/ingredients`,
  );
  return normalizeOrderOptionIngredientsResult(result);
}

export async function replaceOrderOptionIngredients(
  orderOptionId: string,
  ingredients: OrderOptionIngredientInput[],
) {
  const result = await api.put<OrderOptionIngredientsResponseRaw>(
    `/api/admin/order-options/${orderOptionId}/ingredients`,
    { ingredients },
  );
  return normalizeOrderOptionIngredientsResult(result);
}
