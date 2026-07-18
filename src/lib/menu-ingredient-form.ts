import type {
  CookingMeasurement,
  FoodSupply,
  Menu,
  MenuIngredient,
  MenuIngredientInput,
} from "@/lib/api/types";
import { isMenuReferenceIngredient } from "@/lib/api/types";
import {
  BASE_UNIT_SELECTION,
  getIngredientDisplayQuantity,
  getIngredientUnitSelection,
} from "@/lib/menu-ingredient-units";

export type IngredientLineType = "food_supply" | "menu";

export interface IngredientRowState {
  key: string;
  line_type: IngredientLineType;
  food_supply_id: string;
  quantity: string;
  unit_selection: string;
  cooking_measurements: CookingMeasurement[];
  supply: Pick<FoodSupply, "id" | "title" | "unit" | "stock_quantity"> | null;
  ingredient_menu_id: string;
  menu: Pick<Menu, "id" | "title" | "category_name"> | null;
}

export interface RowErrors {
  food_supply_id?: string;
  ingredient_menu_id?: string;
  quantity_per_unit?: string;
}

export function parsePositiveQuantity(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function ingredientToRow(ingredient: MenuIngredient): IngredientRowState {
  if (isMenuReferenceIngredient(ingredient)) {
    return {
      key: createRowKey(),
      line_type: "menu",
      food_supply_id: "",
      quantity: String(ingredient.quantity_per_unit),
      unit_selection: BASE_UNIT_SELECTION,
      cooking_measurements: [],
      supply: null,
      ingredient_menu_id: ingredient.ingredient_menu_id,
      menu: {
        id: ingredient.ingredient_menu_id,
        title: ingredient.ingredient_menu_title ?? ingredient.ingredient_menu_id,
        category_name: "",
      },
    };
  }

  return {
    key: createRowKey(),
    line_type: "food_supply",
    food_supply_id: ingredient.food_supply_id ?? "",
    quantity: getIngredientDisplayQuantity(ingredient),
    unit_selection: getIngredientUnitSelection(ingredient),
    cooking_measurements: [],
    supply: {
      id: ingredient.food_supply_id ?? "",
      title: ingredient.food_supply_title ?? "",
      unit: ingredient.food_supply_unit ?? "gr",
      stock_quantity: ingredient.food_supply_stock_quantity ?? 0,
    },
    ingredient_menu_id: "",
    menu: null,
  };
}

let rowKeyCounter = 0;

export function createRowKey() {
  rowKeyCounter += 1;
  return `ingredient-row-${rowKeyCounter}`;
}

export function resetRowKeyCounter() {
  rowKeyCounter = 0;
}

export function createBlankRow(
  lineType: IngredientLineType = "food_supply",
): IngredientRowState {
  return {
    key: createRowKey(),
    line_type: lineType,
    food_supply_id: "",
    quantity: "",
    unit_selection: BASE_UNIT_SELECTION,
    cooking_measurements: [],
    supply: null,
    ingredient_menu_id: "",
    menu: null,
  };
}

export function validateRows(rows: IngredientRowState[]) {
  const rowErrors: Record<string, RowErrors> = {};
  const seenFoodSupplies = new Map<string, number>();
  const seenMenus = new Map<string, number>();

  rows.forEach((row, index) => {
    const errors: RowErrors = {};

    if (row.line_type === "food_supply") {
      if (!row.food_supply_id) {
        errors.food_supply_id = "Select a food supply";
      }

      if (row.food_supply_id) {
        const firstIndex = seenFoodSupplies.get(row.food_supply_id);
        if (firstIndex !== undefined) {
          errors.food_supply_id = "This food supply is already selected";
          const firstKey = rows[firstIndex]?.key;
          if (firstKey && !rowErrors[firstKey]?.food_supply_id) {
            rowErrors[firstKey] = {
              ...rowErrors[firstKey],
              food_supply_id: "This food supply is already selected",
            };
          }
        } else {
          seenFoodSupplies.set(row.food_supply_id, index);
        }
      }
    } else {
      if (!row.ingredient_menu_id) {
        errors.ingredient_menu_id = "Select a menu";
      }

      if (row.ingredient_menu_id) {
        const firstIndex = seenMenus.get(row.ingredient_menu_id);
        if (firstIndex !== undefined) {
          errors.ingredient_menu_id = "This menu is already selected";
          const firstKey = rows[firstIndex]?.key;
          if (firstKey && !rowErrors[firstKey]?.ingredient_menu_id) {
            rowErrors[firstKey] = {
              ...rowErrors[firstKey],
              ingredient_menu_id: "This menu is already selected",
            };
          }
        } else {
          seenMenus.set(row.ingredient_menu_id, index);
        }
      }
    }

    const quantity = parsePositiveQuantity(row.quantity);
    if (quantity === null) {
      errors.quantity_per_unit = "Enter a quantity greater than 0";
    }

    if (Object.keys(errors).length > 0) {
      rowErrors[row.key] = errors;
    }
  });

  return rowErrors;
}

export function mapServerFieldErrors(
  fields: Record<string, string>,
  rows: IngredientRowState[],
) {
  const rowErrors: Record<string, RowErrors> = {};
  let generalError: string | null = null;

  for (const [field, message] of Object.entries(fields)) {
    const match = /^ingredients(?:\[(\d+)\])?\.(.+)$/.exec(field);
    if (match) {
      const index = Number(match[1] ?? "0");
      const property = match[2];
      const row = rows[index];
      if (!row) continue;
      if (
        property === "food_supply_id" ||
        property === "ingredient_menu_id" ||
        property === "quantity_per_unit" ||
        property === "cooking_measurement_id"
      ) {
        const mappedProperty =
          property === "cooking_measurement_id" ? "quantity_per_unit" : property;
        rowErrors[row.key] = {
          ...rowErrors[row.key],
          [mappedProperty]: message,
        };
      }
      continue;
    }

    if (field === "ingredients") {
      generalError = message;
      continue;
    }

    generalError = message;
  }

  return { rowErrors, generalError };
}

export function rowToPayload(row: IngredientRowState): MenuIngredientInput {
  const quantity = parsePositiveQuantity(row.quantity) as number;

  if (row.line_type === "menu") {
    return {
      ingredient_menu_id: row.ingredient_menu_id,
      quantity_per_unit: quantity,
    };
  }

  if (row.unit_selection === BASE_UNIT_SELECTION) {
    return {
      food_supply_id: row.food_supply_id,
      quantity_per_unit: quantity,
    };
  }

  return {
    food_supply_id: row.food_supply_id,
    quantity_per_unit: quantity,
    cooking_measurement_id: row.unit_selection,
  };
}

export function rowsToPayload(rows: IngredientRowState[]): MenuIngredientInput[] {
  return rows.map(rowToPayload);
}
