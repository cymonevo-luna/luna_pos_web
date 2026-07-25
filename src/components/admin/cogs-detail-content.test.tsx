import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CogsDetailContent } from "./cogs-detail-content";
import {
  backendDetailFixture,
  backendSummaryFixture,
} from "@/lib/api/cogs-mapper.fixtures";
import { normalizeCogsMenuDetail } from "@/lib/api/cogs-mapper";
import type { CogsMenuDetail } from "@/lib/api/types";

const mappedDetail = normalizeCogsMenuDetail(backendDetailFixture);

describe("CogsDetailContent", () => {
  it("renders ingredient supplier quote tables from mapped backend detail", () => {
    render(<CogsDetailContent detail={mappedDetail} />);

    expect(screen.getByText("Ingredient breakdown")).toBeInTheDocument();
    expect(screen.getByText("Beef Chuck")).toBeInTheDocument();
    expect(screen.getByText("Coconut Milk")).toBeInTheDocument();
    expect(screen.getByText("Local Market")).toBeInTheDocument();
    expect(screen.getAllByText("Premium Meats").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Yes").length).toBeGreaterThan(0);
  });

  it("renders actual margin in price comparison section", () => {
    const detailWithActualMargin: CogsMenuDetail = {
      ...mappedDetail,
      actual_margin_percent: 50.2,
    };

    render(<CogsDetailContent detail={detailWithActualMargin} />);

    expect(screen.getByText("Actual margin")).toBeInTheDocument();
    expect(screen.getByText("50.20%")).toBeInTheDocument();
  });

  it("rounds long actual margin percent to two decimals", () => {
    const detailWithLongActualMargin: CogsMenuDetail = {
      ...mappedDetail,
      actual_margin_percent: 217.61006289308176,
    };

    render(<CogsDetailContent detail={detailWithLongActualMargin} />);

    expect(screen.getByText("217.61%")).toBeInTheDocument();
  });

  it("formats margin with two decimal places", () => {
    const detailWithIntegerMargin: CogsMenuDetail = {
      ...mappedDetail,
      margin_percent: 30,
    };

    render(<CogsDetailContent detail={detailWithIntegerMargin} />);

    expect(screen.getByText("30.00%")).toBeInTheDocument();
  });

  it("renders dash when actual margin is null", () => {
    const detailWithoutActualMargin: CogsMenuDetail = {
      ...mappedDetail,
      actual_margin_percent: null,
    };

    render(<CogsDetailContent detail={detailWithoutActualMargin} />);

    const actualMarginLabel = screen.getByText("Actual margin");
    const actualMarginCard = actualMarginLabel.closest("div");
    expect(actualMarginCard).not.toBeNull();
    expect(within(actualMarginCard!).getByText("—")).toBeInTheDocument();
  });

  it("renders empty state for no_formula without throwing", () => {
    const noFormulaDetail: CogsMenuDetail = {
      ...normalizeCogsMenuDetail({
        ...backendSummaryFixture,
        recipe_yield: 1,
        completeness: "no_formula",
        cogs_per_piece: null,
      }),
      ingredients: [],
    };

    render(<CogsDetailContent detail={noFormulaDetail} />);

    expect(
      screen.getByText("No ingredient formula configured for this menu."),
    ).toBeInTheDocument();
  });

  it("does not throw when ingredients or supplier_quotes are missing", () => {
    const partialDetail = {
      ...mappedDetail,
      ingredients: [
        {
          food_supply_id: "fs-1",
          food_supply_title: "Rice",
          quantity_batch: 200,
          quantity_per_piece: 200,
          unit: "gr" as const,
          selected_supplier_id: null,
          selected_supplier_name: null,
          selected_unit_price: null,
          line_cost: null,
        },
      ],
    } as unknown as CogsMenuDetail;

    expect(() =>
      render(<CogsDetailContent detail={partialDetail} />),
    ).not.toThrow();
    expect(screen.getByText("Rice")).toBeInTheDocument();
    expect(
      screen.getByText("No supplier quotes available."),
    ).toBeInTheDocument();
  });
});
