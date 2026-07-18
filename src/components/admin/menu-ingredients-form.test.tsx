import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuIngredientsForm } from "./menu-ingredients-form";
import {
  getMenuIngredients,
  replaceMenuIngredients,
} from "@/lib/api/menu-ingredients";
import { foodSuppliesAdminApi } from "@/lib/api/food-supplies";
import { ApiError } from "@/lib/api/client";
import { toast } from "sonner";
import { MENU_INGREDIENT_QUANTITY_HELP } from "@/lib/menu-cogs";

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

vi.mock("@/lib/api/food-supplies", () => ({
  foodSuppliesAdminApi: {
    get: vi.fn(),
  },
}));

const saltCookingMeasurements = [
  { id: "cm-tbsp", name: "Tablespoon", conversion_quantity: "10" },
];

const supplyFixtures = {
  "supply-1": {
    id: "supply-1",
    title: "Olive oil",
    unit: "ml" as const,
    stock_quantity: 100,
    cooking_measurements: [],
  },
  "supply-2": {
    id: "supply-2",
    title: "Salt",
    unit: "gr" as const,
    stock_quantity: 50,
    cooking_measurements: saltCookingMeasurements,
  },
  "supply-3": {
    id: "supply-3",
    title: "Flour",
    unit: "gr" as const,
    stock_quantity: 5000,
    cooking_measurements: [],
  },
};

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
    onChange: (supply: (typeof supplyFixtures)[keyof typeof supplyFixtures]) => void;
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
          const id = event.target.value as keyof typeof supplyFixtures;
          if (!id) return;
          onChange(supplyFixtures[id]);
        }}
      >
        <option value="">Select</option>
        <option value="supply-1" disabled={excludeIds?.includes("supply-1")}>
          Olive oil
        </option>
        <option value="supply-2" disabled={excludeIds?.includes("supply-2")}>
          Salt
        </option>
        <option value="supply-3" disabled={excludeIds?.includes("supply-3")}>
          Flour
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
    vi.mocked(foodSuppliesAdminApi.get).mockImplementation(async (id) => ({
      data: {
        ...supplyFixtures[id as keyof typeof supplyFixtures],
        description: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        manual_edit_history: [],
      },
    }));
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

  it("shows recipe yield batch help text", async () => {
    render(<MenuIngredientsForm menuId="menu-1" />);

    expect(await screen.findByText(MENU_INGREDIENT_QUANTITY_HELP)).toBeInTheDocument();
  });

  it("shows per-portion preview when recipe yield is greater than 1", async () => {
    vi.mocked(getMenuIngredients).mockResolvedValue({
      data: {
        menu_id: "menu-1",
        ingredients: [
          {
            food_supply_id: "supply-3",
            quantity_per_unit: 2000,
            food_supply_title: "Flour",
            food_supply_unit: "gr",
            food_supply_stock_quantity: 5000,
          },
        ],
      },
    });

    render(<MenuIngredientsForm menuId="menu-1" recipeYield={40} />);
    await screen.findByLabelText("Ingredient 1");

    expect(screen.getByTestId("per-portion-preview")).toHaveTextContent(
      "50 gr per portion",
    );
  });

  it("hides per-portion preview when recipe yield is 1", async () => {
    render(<MenuIngredientsForm menuId="menu-1" recipeYield={1} />);
    await screen.findByLabelText("Ingredient 1");

    expect(screen.queryByTestId("per-portion-preview")).not.toBeInTheDocument();
  });

  it("loads and renders existing ingredients", async () => {
    render(<MenuIngredientsForm menuId="menu-1" />);

    expect(await screen.findByText("Ingredients")).toBeInTheDocument();
    expect(screen.getByLabelText("Ingredient 1")).toHaveValue("supply-1");
    expect(screen.getByLabelText("Quantity per unit")).toHaveValue(2);
    expect(screen.getByText("ml")).toBeInTheDocument();
  });

  it("loads cooking measurement ingredients with entry quantity and unit", async () => {
    vi.mocked(getMenuIngredients).mockResolvedValue({
      data: {
        menu_id: "menu-1",
        ingredients: [
          {
            food_supply_id: "supply-2",
            quantity_per_unit: 5,
            entry_quantity: 0.5,
            cooking_measurement_id: "cm-tbsp",
            cooking_measurement_name: "Tablespoon",
            food_supply_title: "Salt",
            food_supply_unit: "gr",
            food_supply_stock_quantity: 50,
          },
        ],
      },
    });

    render(<MenuIngredientsForm menuId="menu-1" />);
    await screen.findByLabelText("Ingredient 1");

    expect(screen.getByLabelText("Quantity per unit")).toHaveValue(0.5);
    expect(screen.getByLabelText("Unit for ingredient 1")).toHaveValue("cm-tbsp");
    expect(screen.getByText("= 5 gr")).toBeInTheDocument();
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

  it("saves cooking measurement quantities with cooking_measurement_id", async () => {
    const user = userEvent.setup();
    vi.mocked(getMenuIngredients).mockResolvedValue({
      data: {
        menu_id: "menu-1",
        ingredients: [],
      },
    });
    vi.mocked(replaceMenuIngredients).mockResolvedValue({
      data: {
        menu_id: "menu-1",
        ingredients: [
          {
            food_supply_id: "supply-2",
            quantity_per_unit: 5,
            entry_quantity: 0.5,
            cooking_measurement_id: "cm-tbsp",
            cooking_measurement_name: "Tablespoon",
            food_supply_title: "Salt",
            food_supply_unit: "gr",
            food_supply_stock_quantity: 50,
          },
        ],
      },
    });

    render(<MenuIngredientsForm menuId="menu-1" />);
    await screen.findByText(/No ingredients yet/);

    await user.click(screen.getByRole("button", { name: "Add ingredient" }));
    await user.selectOptions(screen.getByLabelText("Ingredient 1"), "supply-2");
    await waitFor(() => {
      expect(screen.getByLabelText("Unit for ingredient 1")).toBeInTheDocument();
    });
    await user.selectOptions(
      screen.getByLabelText("Unit for ingredient 1"),
      "cm-tbsp",
    );
    await user.type(screen.getByLabelText("Quantity per unit"), "0.5");
    await user.click(screen.getByRole("button", { name: "Save ingredients" }));

    await waitFor(() => {
      expect(replaceMenuIngredients).toHaveBeenCalledWith("menu-1", [
        {
          food_supply_id: "supply-2",
          quantity_per_unit: 0.5,
          cooking_measurement_id: "cm-tbsp",
        },
      ]);
    });
  });

  it("saves mixed base and cooking unit lines", async () => {
    const user = userEvent.setup();
    vi.mocked(getMenuIngredients).mockResolvedValue({
      data: {
        menu_id: "menu-1",
        ingredients: [],
      },
    });
    vi.mocked(replaceMenuIngredients).mockResolvedValue({
      data: {
        menu_id: "menu-1",
        ingredients: [
          {
            food_supply_id: "supply-3",
            quantity_per_unit: 200,
            food_supply_title: "Flour",
            food_supply_unit: "gr",
            food_supply_stock_quantity: 5000,
          },
          {
            food_supply_id: "supply-2",
            quantity_per_unit: 5,
            entry_quantity: 0.5,
            cooking_measurement_id: "cm-tbsp",
            cooking_measurement_name: "Tablespoon",
            food_supply_title: "Salt",
            food_supply_unit: "gr",
            food_supply_stock_quantity: 50,
          },
        ],
      },
    });

    render(<MenuIngredientsForm menuId="menu-1" />);
    await screen.findByText(/No ingredients yet/);

    await user.click(screen.getByRole("button", { name: "Add ingredient" }));
    await user.selectOptions(screen.getByLabelText("Ingredient 1"), "supply-3");
    await user.type(screen.getByLabelText("Quantity per unit"), "200");

    await user.click(screen.getByRole("button", { name: "Add ingredient" }));
    await user.selectOptions(screen.getByLabelText("Ingredient 2"), "supply-2");
    await waitFor(() => {
      expect(screen.getByLabelText("Unit for ingredient 2")).toBeInTheDocument();
    });
    const quantityInputs = screen.getAllByLabelText("Quantity per unit");
    await user.selectOptions(
      screen.getByLabelText("Unit for ingredient 2"),
      "cm-tbsp",
    );
    await user.type(quantityInputs[1]!, "0.5");
    await user.click(screen.getByRole("button", { name: "Save ingredients" }));

    await waitFor(() => {
      expect(replaceMenuIngredients).toHaveBeenCalledWith("menu-1", [
        { food_supply_id: "supply-3", quantity_per_unit: 200 },
        {
          food_supply_id: "supply-2",
          quantity_per_unit: 0.5,
          cooking_measurement_id: "cm-tbsp",
        },
      ]);
    });
  });

  it("resets unit selector to base unit when food supply changes", async () => {
    const user = userEvent.setup();
    vi.mocked(getMenuIngredients).mockResolvedValue({
      data: {
        menu_id: "menu-1",
        ingredients: [
          {
            food_supply_id: "supply-2",
            quantity_per_unit: 5,
            entry_quantity: 0.5,
            cooking_measurement_id: "cm-tbsp",
            cooking_measurement_name: "Tablespoon",
            food_supply_title: "Salt",
            food_supply_unit: "gr",
            food_supply_stock_quantity: 50,
          },
        ],
      },
    });

    render(<MenuIngredientsForm menuId="menu-1" />);
    await screen.findByLabelText("Ingredient 1");
    expect(screen.getByLabelText("Unit for ingredient 1")).toHaveValue("cm-tbsp");

    await user.selectOptions(screen.getByLabelText("Ingredient 1"), "supply-1");
    await waitFor(() => {
      expect(screen.queryByLabelText("Unit for ingredient 1")).not.toBeInTheDocument();
    });
    expect(screen.getByText("ml")).toBeInTheDocument();
  });

  it("switches from cooking unit to base unit on save", async () => {
    const user = userEvent.setup();
    vi.mocked(getMenuIngredients).mockResolvedValue({
      data: {
        menu_id: "menu-1",
        ingredients: [
          {
            food_supply_id: "supply-2",
            quantity_per_unit: 5,
            entry_quantity: 0.5,
            cooking_measurement_id: "cm-tbsp",
            cooking_measurement_name: "Tablespoon",
            food_supply_title: "Salt",
            food_supply_unit: "gr",
            food_supply_stock_quantity: 50,
          },
        ],
      },
    });
    vi.mocked(replaceMenuIngredients).mockResolvedValue({
      data: {
        menu_id: "menu-1",
        ingredients: [
          {
            food_supply_id: "supply-2",
            quantity_per_unit: 5,
            food_supply_title: "Salt",
            food_supply_unit: "gr",
            food_supply_stock_quantity: 50,
          },
        ],
      },
    });

    render(<MenuIngredientsForm menuId="menu-1" />);
    await screen.findByLabelText("Ingredient 1");

    await user.selectOptions(
      screen.getByLabelText("Unit for ingredient 1"),
      "base",
    );
    const quantityInput = screen.getByLabelText("Quantity per unit");
    await user.clear(quantityInput);
    await user.type(quantityInput, "5");
    await user.click(screen.getByRole("button", { name: "Save ingredients" }));

    await waitFor(() => {
      expect(replaceMenuIngredients).toHaveBeenCalledWith("menu-1", [
        { food_supply_id: "supply-2", quantity_per_unit: 5 },
      ]);
    });
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
