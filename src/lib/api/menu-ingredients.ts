import { api, type ApiResult } from "./client";
import type {
  FormulaResponse,
  MenuIngredient,
  MenuIngredientInput,
} from "./types";
import { parseStockQuantity } from "./food-supplies";

/** Wire format from the Go backend (`decimal.Decimal` marshals as JSON string). */
interface MenuIngredientRaw
  extends Omit<MenuIngredient, "quantity_per_unit" | "food_supply_stock_quantity"> {
  quantity_per_unit: number | string;
  food_supply_stock_quantity: number | string;
}

interface FormulaResponseRaw extends Omit<FormulaResponse, "ingredients"> {
  ingredients: MenuIngredientRaw[];
}

function normalizeMenuIngredient(raw: MenuIngredientRaw): MenuIngredient {
  return {
    ...raw,
    quantity_per_unit: parseStockQuantity(raw.quantity_per_unit),
    food_supply_stock_quantity: parseStockQuantity(raw.food_supply_stock_quantity),
  };
}

function normalizeFormulaResponse(raw: FormulaResponseRaw): FormulaResponse {
  return {
    ...raw,
    ingredients: raw.ingredients.map(normalizeMenuIngredient),
  };
}

function normalizeFormulaResult(
  result: ApiResult<FormulaResponseRaw>,
): ApiResult<FormulaResponse> {
  return {
    ...result,
    data: normalizeFormulaResponse(result.data),
  };
}

export interface ReplaceMenuIngredientsPayload {
  ingredients: MenuIngredientInput[];
}

export async function getMenuIngredients(menuId: string) {
  const result = await api.get<FormulaResponseRaw>(
    `/api/admin/menus/${menuId}/ingredients`,
  );
  return normalizeFormulaResult(result);
}

export async function replaceMenuIngredients(
  menuId: string,
  ingredients: MenuIngredientInput[],
) {
  const result = await api.put<FormulaResponseRaw>(
    `/api/admin/menus/${menuId}/ingredients`,
    { ingredients },
  );
  return normalizeFormulaResult(result);
}
