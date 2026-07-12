import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuStockEstimationPanel } from "./menu-stock-estimation-panel";
import { getMenuStockEstimation } from "@/lib/api/menu-stock-estimation";
import { ApiError } from "@/lib/api/client";

vi.mock("@/lib/api/menu-stock-estimation", () => ({
  getMenuStockEstimation: vi.fn(),
}));

const sufficientResult = {
  has_formula: true,
  requested_quantity: 10,
  max_producible: 25,
  is_fully_producible: true,
  limiting_ingredient_title: "Rice",
  ingredients: [
    {
      food_supply_title: "Rice",
      unit: "gr" as const,
      quantity_per_unit: 200,
      required_quantity: 2000,
      current_stock_quantity: 5000,
      remaining_after: 3000,
      is_sufficient: true,
    },
  ],
};

const insufficientResult = {
  has_formula: true,
  requested_quantity: 50,
  max_producible: 10,
  is_fully_producible: false,
  limiting_ingredient_title: "Rice",
  ingredients: [
    {
      food_supply_title: "Rice",
      unit: "gr" as const,
      quantity_per_unit: 200,
      required_quantity: 10000,
      current_stock_quantity: 2000,
      remaining_after: -8000,
      is_sufficient: false,
    },
  ],
};

describe("MenuStockEstimationPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders quantity input and estimate button", () => {
    render(<MenuStockEstimationPanel menuId="menu-1" />);

    expect(screen.getByLabelText("Production quantity")).toHaveValue(1);
    expect(screen.getByRole("button", { name: "Estimate" })).toBeInTheDocument();
    expect(screen.getByText("Stock Estimation")).toBeInTheDocument();
  });

  it("shows sufficient stock estimation results", async () => {
    const user = userEvent.setup();
    vi.mocked(getMenuStockEstimation).mockResolvedValue({
      data: sufficientResult,
    });

    render(<MenuStockEstimationPanel menuId="menu-1" />);
    await user.clear(screen.getByLabelText("Production quantity"));
    await user.type(screen.getByLabelText("Production quantity"), "10");
    await user.click(screen.getByRole("button", { name: "Estimate" }));

    expect(await screen.findByTestId("stock-estimation-results")).toBeInTheDocument();
    expect(screen.getByTestId("stock-estimation-status-badge")).toHaveTextContent(
      "Sufficient",
    );
    expect(screen.getByText("2000 gr")).toBeInTheDocument();
    expect(screen.getByText("3000 gr")).toBeInTheDocument();
    expect(getMenuStockEstimation).toHaveBeenCalledWith("menu-1", 10);
  });

  it("shows insufficient stock and highlights limiting ingredient", async () => {
    const user = userEvent.setup();
    vi.mocked(getMenuStockEstimation).mockResolvedValue({
      data: insufficientResult,
    });

    render(<MenuStockEstimationPanel menuId="menu-1" />);
    await user.clear(screen.getByLabelText("Production quantity"));
    await user.type(screen.getByLabelText("Production quantity"), "50");
    await user.click(screen.getByRole("button", { name: "Estimate" }));

    expect(await screen.findByTestId("stock-estimation-results")).toBeInTheDocument();
    expect(screen.getByTestId("stock-estimation-status-badge")).toHaveTextContent(
      "Insufficient",
    );
    expect(
      screen.getByTestId("stock-estimation-limiting-ingredient"),
    ).toHaveTextContent("Limiting ingredient: Rice");
    expect(screen.getByTestId("stock-estimation-limiting-row")).toBeInTheDocument();
    expect(screen.getByText("-8000 gr")).toBeInTheDocument();
  });

  it("shows informational message when menu has no formula", async () => {
    const user = userEvent.setup();
    vi.mocked(getMenuStockEstimation).mockResolvedValue({
      data: {
        has_formula: false,
        requested_quantity: 1,
        message: "No ingredient formula saved for this menu.",
      },
    });

    render(<MenuStockEstimationPanel menuId="menu-1" />);
    await user.click(screen.getByRole("button", { name: "Estimate" }));

    expect(
      await screen.findByTestId("stock-estimation-no-formula"),
    ).toHaveTextContent("No ingredient formula saved for this menu.");
    expect(screen.queryByTestId("stock-estimation-results")).not.toBeInTheDocument();
  });

  it("blocks invalid quantity without calling the API", async () => {
    const user = userEvent.setup();

    render(<MenuStockEstimationPanel menuId="menu-1" />);
    await user.clear(screen.getByLabelText("Production quantity"));
    await user.type(screen.getByLabelText("Production quantity"), "0");

    expect(screen.getByRole("button", { name: "Estimate" })).toBeDisabled();
    expect(getMenuStockEstimation).not.toHaveBeenCalled();
  });

  it("blocks negative quantity without calling the API", async () => {
    const user = userEvent.setup();

    render(<MenuStockEstimationPanel menuId="menu-1" />);
    await user.clear(screen.getByLabelText("Production quantity"));
    await user.type(screen.getByLabelText("Production quantity"), "-5");

    expect(screen.getByRole("button", { name: "Estimate" })).toBeDisabled();
    expect(getMenuStockEstimation).not.toHaveBeenCalled();
  });

  it("handles 404 errors with a friendly message", async () => {
    const user = userEvent.setup();
    vi.mocked(getMenuStockEstimation).mockRejectedValue(
      new ApiError(404, "not_found", "Menu not found"),
    );

    render(<MenuStockEstimationPanel menuId="menu-1" />);
    await user.click(screen.getByRole("button", { name: "Estimate" }));

    expect(
      await screen.findByText("Menu not found. Close and reopen the editor."),
    ).toBeInTheDocument();
  });

  it("handles 422 errors with a friendly message", async () => {
    const user = userEvent.setup();
    vi.mocked(getMenuStockEstimation).mockRejectedValue(
      new ApiError(422, "validation_error", "Quantity must be positive"),
    );

    render(<MenuStockEstimationPanel menuId="menu-1" />);
    await user.click(screen.getByRole("button", { name: "Estimate" }));

    expect(
      await screen.findByText("Quantity must be positive"),
    ).toBeInTheDocument();
  });

  it("shows loading state while fetching", async () => {
    const user = userEvent.setup();
    let resolveRequest: (value: { data: typeof sufficientResult }) => void;
    const pending = new Promise<{ data: typeof sufficientResult }>((resolve) => {
      resolveRequest = resolve;
    });
    vi.mocked(getMenuStockEstimation).mockReturnValue(pending);

    render(<MenuStockEstimationPanel menuId="menu-1" />);
    await user.click(screen.getByRole("button", { name: "Estimate" }));

    expect(screen.getByTestId("stock-estimation-loading")).toBeInTheDocument();

    resolveRequest!({ data: sufficientResult });
    await waitFor(() => {
      expect(screen.queryByTestId("stock-estimation-loading")).not.toBeInTheDocument();
    });
  });
});
