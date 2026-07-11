import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuIngredientsForm } from "./menu-ingredients-form";
import {
  getMenuIngredients,
  replaceMenuIngredients,
} from "@/lib/api/menu-ingredients";
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

vi.mock("@/lib/api/menu-ingredients", () => ({
  getMenuIngredients: vi.fn(),
  replaceMenuIngredients: vi.fn(),
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
          onChange({
            id,
            title: id === "supply-1" ? "Olive oil" : "Salt",
            unit: id === "supply-1" ? "ml" : "gr",
            stock_quantity: 100,
          });
        }}
      >
        <option value="">Select</option>
        <option value="supply-1" disabled={excludeIds?.includes("supply-1")}>
          Olive oil
        </option>
        <option value="supply-2" disabled={excludeIds?.includes("supply-2")}>
          Salt
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

describe("MenuIngredientsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMenuIngredients).mockResolvedValue({
      data: {
        menu_id: "menu-1",
        ingredients: [
          {
            food_supply_id: "supply-1",
            quantity_per_unit: 2,
            food_supply_title: "Olive oil",
            food_supply_unit: "ml",
            food_supply_stock_quantity: 100,
          },
        ],
      },
    });
  });

  it("loads and renders existing ingredients", async () => {
    render(<MenuIngredientsForm menuId="menu-1" />);

    expect(await screen.findByText("Ingredients")).toBeInTheDocument();
    expect(screen.getByLabelText("Ingredient 1")).toHaveValue("supply-1");
    expect(screen.getByLabelText("Quantity per unit")).toHaveValue(2);
    expect(screen.getByText("ml")).toBeInTheDocument();
  });

  it("saves a new formula", async () => {
    const user = userEvent.setup();
    vi.mocked(replaceMenuIngredients).mockResolvedValue({
      data: {
        menu_id: "menu-1",
        ingredients: [
          {
            food_supply_id: "supply-1",
            quantity_per_unit: 3,
            food_supply_title: "Olive oil",
            food_supply_unit: "ml",
            food_supply_stock_quantity: 100,
          },
          {
            food_supply_id: "supply-2",
            quantity_per_unit: 1.5,
            food_supply_title: "Salt",
            food_supply_unit: "gr",
            food_supply_stock_quantity: 50,
          },
        ],
      },
    });

    render(<MenuIngredientsForm menuId="menu-1" />);
    await screen.findByLabelText("Ingredient 1");

    await user.click(screen.getByRole("button", { name: "Add ingredient" }));
    await user.selectOptions(screen.getByLabelText("Ingredient 2"), "supply-2");
    const quantityInputs = screen.getAllByLabelText("Quantity per unit");
    await user.clear(quantityInputs[0]!);
    await user.type(quantityInputs[0]!, "3");
    await user.type(quantityInputs[1]!, "1.5");
    await user.click(screen.getByRole("button", { name: "Save ingredients" }));

    await waitFor(() => {
      expect(replaceMenuIngredients).toHaveBeenCalledWith("menu-1", [
        { food_supply_id: "supply-1", quantity_per_unit: 3 },
        { food_supply_id: "supply-2", quantity_per_unit: 1.5 },
      ]);
    });
    expect(toast.success).toHaveBeenCalledWith("Ingredients saved");
  });

  it("blocks duplicate food supplies before submit", async () => {
    vi.mocked(getMenuIngredients).mockResolvedValue({
      data: {
        menu_id: "menu-1",
        ingredients: [
          {
            food_supply_id: "supply-1",
            quantity_per_unit: 1,
            food_supply_title: "Olive oil",
            food_supply_unit: "ml",
            food_supply_stock_quantity: 100,
          },
          {
            food_supply_id: "supply-1",
            quantity_per_unit: 2,
            food_supply_title: "Olive oil",
            food_supply_unit: "ml",
            food_supply_stock_quantity: 100,
          },
        ],
      },
    });
    const user = userEvent.setup();

    render(<MenuIngredientsForm menuId="menu-1" />);
    await screen.findByLabelText("Ingredient 1");

    await user.click(screen.getByRole("button", { name: "Save ingredients" }));

    expect(
      await screen.findAllByText("This food supply is already selected"),
    ).toHaveLength(2);
    expect(replaceMenuIngredients).not.toHaveBeenCalled();
  });

  it("allows clearing the formula", async () => {
    const user = userEvent.setup();
    vi.mocked(replaceMenuIngredients).mockResolvedValue({
      data: {
        menu_id: "menu-1",
        ingredients: [],
      },
    });

    render(<MenuIngredientsForm menuId="menu-1" />);
    await screen.findByLabelText("Ingredient 1");

    await user.click(screen.getByLabelText("Remove ingredient 1"));
    await user.click(screen.getByRole("button", { name: "Save ingredients" }));

    await waitFor(() => {
      expect(replaceMenuIngredients).toHaveBeenCalledWith("menu-1", []);
    });
  });

  it("maps server validation errors onto rows", async () => {
    const user = userEvent.setup();
    vi.mocked(replaceMenuIngredients).mockRejectedValue(
      new ApiError(422, "validation_error", "Validation failed", {
        "ingredients[0].quantity_per_unit": "Quantity is too low",
      }),
    );

    render(<MenuIngredientsForm menuId="menu-1" />);
    await screen.findByLabelText("Ingredient 1");

    await user.click(screen.getByRole("button", { name: "Save ingredients" }));

    expect(await screen.findByText("Quantity is too low")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Validation failed");
  });
});
