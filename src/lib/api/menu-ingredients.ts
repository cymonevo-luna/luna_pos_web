import { api, type ApiResult } from "./client";
import type {
  FormulaResponse,
  MenuIngredient,
  MenuIngredientInput,
} from "./types";
import { isMenuReferenceIngredient } from "./types";
import { parseStockQuantity } from "./food-supplies";

/** Wire format from the Go backend (`decimal.Decimal` marshals as JSON string). */
interface MenuIngredientRaw {
  id?: string;
  food_supply_id?: string;
  food_supply_title?: string;
  quantity_per_unit: number | string;
  /** Live API field name (menuingredient.IngredientResponse). */
  unit?: MenuIngredient["food_supply_unit"];
  /** Legacy/mock field name kept for backward compatibility. */
  food_supply_unit?: MenuIngredient["food_supply_unit"];
  /** Live API field name (menuingredient.IngredientResponse). */
  current_stock_quantity?: number | string;
  /** Legacy/mock field name kept for backward compatibility. */
  food_supply_stock_quantity?: number | string;
  cooking_measurement_id?: string;
  cooking_measurement_name?: string | null;
  entry_quantity?: number | string;
  ingredient_menu_id?: string;
  ingredient_menu_title?: string;
}

interface FormulaResponseRaw extends Omit<FormulaResponse, "ingredients"> {
  ingredients: MenuIngredientRaw[];
}

function normalizeMenuIngredient(raw: MenuIngredientRaw): MenuIngredient {
  const {
    entry_quantity: rawEntryQuantity,
    unit,
    food_supply_unit,
    current_stock_quantity,
    food_supply_stock_quantity,
    ...rest
  } = raw;

  const ingredient: MenuIngredient = {
    ...rest,
    quantity_per_unit: parseStockQuantity(raw.quantity_per_unit),
  };

  if (isMenuReferenceIngredient(ingredient)) {
    return ingredient;
  }

  const resolvedUnit = food_supply_unit ?? unit;
  if (!resolvedUnit) {
    throw new Error("Food supply menu ingredient response missing unit");
  }

  ingredient.food_supply_unit = resolvedUnit;
  ingredient.food_supply_stock_quantity = parseStockQuantity(
    food_supply_stock_quantity ?? current_stock_quantity ?? 0,
  );

  if (rawEntryQuantity != null) {
    ingredient.entry_quantity = parseStockQuantity(rawEntryQuantity);
  }

  return ingredient;
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
