import { MENU_INGREDIENT_QUANTITY_HELP, quantityPerPortion } from "@/lib/menu-cogs";
import { formatStockQuantity } from "@/lib/utils";

export function MenuFormulaIngredientQuantityHelp() {
  return (
    <p className="text-xs text-muted-foreground">
      {MENU_INGREDIENT_QUANTITY_HELP}
    </p>
  );
}

export interface MenuFormulaPerPortionPreviewProps {
  quantity: number;
  unit: string;
  recipeYield: number;
}

export function MenuFormulaPerPortionPreview({
  quantity,
  unit,
  recipeYield,
}: MenuFormulaPerPortionPreviewProps) {
  if (recipeYield <= 1) {
    return null;
  }

  const perPortion = quantityPerPortion(quantity, recipeYield);
  if (perPortion === null) {
    return null;
  }

  return (
    <p className="text-xs text-muted-foreground" data-testid="per-portion-preview">
      {formatStockQuantity(perPortion, unit)} per portion
    </p>
  );
}
