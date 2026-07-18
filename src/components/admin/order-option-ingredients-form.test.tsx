import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderOptionIngredientsForm } from "./order-option-ingredients-form";
import {
  getOrderOptionIngredients,
  replaceOrderOptionIngredients,
} from "@/lib/api/order-option-ingredients";
import { ApiError } from "@/lib/api/client";
import { toast } from "sonner";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/api/order-option-ingredients", () => ({
  getOrderOptionIngredients: vi.fn(),
  replaceOrderOptionIngredients: vi.fn(),
}));

vi.mock("@/components/admin/food-supply-picker", () => ({
  FoodSupplyPicker: ({
    label,
    value,
    onChange,
    error,
    excludeIds,
  }: {
    label: string;
    value: string;
    onChange: (supply: {
      id: string;
      title: string;
      unit: string;
      stock_quantity: number;
    }) => void;
    error?: string;
    excludeIds?: string[];
  }) => (
    <div>
      <label htmlFor={`picker-${label}`}>{label}</label>
      <select
        id={`picker-${label}`}
        aria-label={label}
        value={value}
        onChange={(event) => {
          const id = event.target.value;
          if (!id) return;
          const supplies: Record<
            string,
            { title: string; unit: string; stock_quantity: number }
          > = {
            "supply-paper": { title: "Paper", unit: "piece", stock_quantity: 500 },
            "supply-food-paper": {
              title: "Food paper",
              unit: "piece",
              stock_quantity: 300,
            },
            "supply-box": { title: "Box", unit: "piece", stock_quantity: 100 },
          };
          const supply = supplies[id];
          if (!supply) return;
          onChange({
            id,
            title: supply.title,
            unit: supply.unit,
            stock_quantity: supply.stock_quantity,
          });
        }}
      >
        <option value="">Select</option>
        <option
          value="supply-paper"
          disabled={excludeIds?.includes("supply-paper")}
        >
          Paper
        </option>
        <option
          value="supply-food-paper"
          disabled={excludeIds?.includes("supply-food-paper")}
        >
          Food paper
        </option>
        <option
          value="supply-box"
          disabled={excludeIds?.includes("supply-box")}
        >
          Box
        </option>
      </select>
      {error && <p>{error}</p>}
    </div>
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("OrderOptionIngredientsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrderOptionIngredients).mockResolvedValue({
      data: {
        order_option_id: "opt-1",
        ingredients: [
          {
            food_supply_id: "supply-paper",
            quantity: 1,
            food_supply_title: "Paper",
            food_supply_unit: "piece",
            current_stock_quantity: 500,
          },
        ],
      },
    });
  });

  it("loads and renders existing ingredients with current stock", async () => {
    render(<OrderOptionIngredientsForm orderOptionId="opt-1" />);

    expect(await screen.findByText("Ingredients")).toBeInTheDocument();
    expect(screen.getByLabelText("Ingredient 1")).toHaveValue("supply-paper");
    expect(screen.getByLabelText("Quantity per order")).toHaveValue(1);
    expect(screen.getByText("piece")).toBeInTheDocument();
    expect(screen.getByText("500 pcs")).toBeInTheDocument();
  });

  it("saves a new formula", async () => {
    const user = userEvent.setup();
    vi.mocked(replaceOrderOptionIngredients).mockResolvedValue({
      data: {
        order_option_id: "opt-1",
        ingredients: [
          {
            food_supply_id: "supply-paper",
            quantity: 1,
            food_supply_title: "Paper",
            food_supply_unit: "piece",
            current_stock_quantity: 500,
          },
          {
            food_supply_id: "supply-food-paper",
            quantity: 1,
            food_supply_title: "Food paper",
            food_supply_unit: "piece",
            current_stock_quantity: 300,
          },
        ],
      },
    });

    render(<OrderOptionIngredientsForm orderOptionId="opt-1" />);
    await screen.findByLabelText("Ingredient 1");

    await user.click(screen.getByRole("button", { name: "Add ingredient" }));
    await user.selectOptions(
      screen.getByLabelText("Ingredient 2"),
      "supply-food-paper",
    );
    const quantityInputs = screen.getAllByLabelText("Quantity per order");
    await user.type(quantityInputs[1]!, "1");
    await user.click(screen.getByRole("button", { name: "Save ingredients" }));

    await waitFor(() => {
      expect(replaceOrderOptionIngredients).toHaveBeenCalledWith("opt-1", [
        { food_supply_id: "supply-paper", quantity: 1 },
        { food_supply_id: "supply-food-paper", quantity: 1 },
      ]);
    });
    expect(toast.success).toHaveBeenCalledWith("Ingredients saved");
  });

  it("blocks duplicate food supplies before submit", async () => {
    vi.mocked(getOrderOptionIngredients).mockResolvedValue({
      data: {
        order_option_id: "opt-1",
        ingredients: [
          {
            food_supply_id: "supply-paper",
            quantity: 1,
            food_supply_title: "Paper",
            food_supply_unit: "piece",
            current_stock_quantity: 500,
          },
          {
            food_supply_id: "supply-paper",
            quantity: 2,
            food_supply_title: "Paper",
            food_supply_unit: "piece",
            current_stock_quantity: 500,
          },
        ],
      },
    });
    const user = userEvent.setup();

    render(<OrderOptionIngredientsForm orderOptionId="opt-1" />);
    await screen.findByLabelText("Ingredient 1");

    await user.click(screen.getByRole("button", { name: "Save ingredients" }));

    expect(
      await screen.findAllByText("This food supply is already selected"),
    ).toHaveLength(2);
    expect(replaceOrderOptionIngredients).not.toHaveBeenCalled();
  });

  it("rejects zero quantity before submit", async () => {
    const user = userEvent.setup();

    render(<OrderOptionIngredientsForm orderOptionId="opt-1" />);
    await screen.findByLabelText("Ingredient 1");

    await user.clear(screen.getByLabelText("Quantity per order"));
    await user.type(screen.getByLabelText("Quantity per order"), "0");
    await user.click(screen.getByRole("button", { name: "Save ingredients" }));

    expect(
      await screen.findByText("Enter a quantity greater than 0"),
    ).toBeInTheDocument();
    expect(replaceOrderOptionIngredients).not.toHaveBeenCalled();
  });

  it("allows clearing the formula", async () => {
    const user = userEvent.setup();
    vi.mocked(replaceOrderOptionIngredients).mockResolvedValue({
      data: {
        order_option_id: "opt-1",
        ingredients: [],
      },
    });

    render(<OrderOptionIngredientsForm orderOptionId="opt-1" />);
    await screen.findByLabelText("Ingredient 1");

    await user.click(screen.getByLabelText("Remove ingredient 1"));
    await user.click(screen.getByRole("button", { name: "Save ingredients" }));

    await waitFor(() => {
      expect(replaceOrderOptionIngredients).toHaveBeenCalledWith("opt-1", []);
    });
  });

  it("maps server validation errors onto rows", async () => {
    const user = userEvent.setup();
    vi.mocked(replaceOrderOptionIngredients).mockRejectedValue(
      new ApiError(422, "validation_error", "Validation failed", {
        "ingredients[0].food_supply_id": "Invalid food supply",
      }),
    );

    render(<OrderOptionIngredientsForm orderOptionId="opt-1" />);
    await screen.findByLabelText("Ingredient 1");

    await user.click(screen.getByRole("button", { name: "Save ingredients" }));

    expect(await screen.findByText("Invalid food supply")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Validation failed");
  });
});
