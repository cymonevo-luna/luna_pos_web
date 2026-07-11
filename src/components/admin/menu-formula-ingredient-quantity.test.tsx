import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  MenuFormulaIngredientQuantityHelp,
  MenuFormulaPerPortionPreview,
} from "./menu-formula-ingredient-quantity";
import { MENU_INGREDIENT_QUANTITY_HELP } from "@/lib/menu-cogs";

describe("MenuFormulaIngredientQuantityHelp", () => {
  it("shows updated help text for ingredient quantities", () => {
    render(<MenuFormulaIngredientQuantityHelp />);

    expect(screen.getByText(MENU_INGREDIENT_QUANTITY_HELP)).toBeInTheDocument();
  });
});

describe("MenuFormulaPerPortionPreview", () => {
  it("shows per-portion quantity when recipe yield is greater than 1", () => {
    render(
      <MenuFormulaPerPortionPreview
        quantity={2000}
        unit="gr"
        recipeYield={40}
      />,
    );

    expect(screen.getByTestId("per-portion-preview")).toHaveTextContent(
      "50 gr per portion",
    );
  });

  it("hides preview when recipe yield is 1", () => {
    render(
      <MenuFormulaPerPortionPreview quantity={2000} unit="gr" recipeYield={1} />,
    );

    expect(screen.queryByTestId("per-portion-preview")).not.toBeInTheDocument();
  });
});
