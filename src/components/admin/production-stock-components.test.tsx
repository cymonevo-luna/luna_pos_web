import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductionLineStockEstimation } from "./production-line-stock-estimation";
import { ProductionAggregatedIngredientsTable } from "./production-aggregated-ingredients-table";

const lineItem = {
  menu_id: "menu-a",
  menu_title: "Nasi Goreng",
  quantity: 5,
  stock_estimation: {
    has_formula: true,
    is_fully_producible: true,
    limiting_ingredient_title: null,
    ingredients: [
      {
        food_supply_id: "fs-1",
        food_supply_title: "Rice",
        unit: "gr" as const,
        quantity_per_unit: 200,
        required_quantity: 1000,
        current_stock_quantity: 5000,
        remaining_after: 4000,
        is_sufficient: true,
      },
    ],
  },
};

describe("ProductionLineStockEstimation", () => {
  it("renders header with sufficient stock badge by default", () => {
    render(<ProductionLineStockEstimation item={lineItem} />);

    expect(screen.getByText("Nasi Goreng")).toBeInTheDocument();
    expect(
      screen.getByTestId("production-estimation-status-badge-menu-a"),
    ).toHaveTextContent("Sufficient stock");
  });

  it("omits header when showHeader is false", () => {
    render(<ProductionLineStockEstimation item={lineItem} showHeader={false} />);

    expect(screen.queryByText("Nasi Goreng")).not.toBeInTheDocument();
    expect(
      screen.getByTestId("production-estimation-status-badge-menu-a"),
    ).toHaveTextContent("Sufficient stock");
  });
});

describe("ProductionAggregatedIngredientsTable", () => {
  it("renders ingredient rows with status badges", () => {
    render(
      <ProductionAggregatedIngredientsTable
        ingredients={[
          {
            food_supply_id: "fs-1",
            food_supply_title: "Rice",
            unit: "gr",
            required_quantity: 1000,
            current_stock_quantity: 5000,
            remaining_after: 4000,
            is_sufficient: true,
          },
        ]}
      />,
    );

    expect(screen.getByText("Rice")).toBeInTheDocument();
    expect(screen.getByText("OK")).toBeInTheDocument();
  });

  it("returns null when ingredients array is empty", () => {
    const { container } = render(
      <ProductionAggregatedIngredientsTable ingredients={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
