import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRef } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ProductionRequestForm,
  type ProductionRequestFormHandle,
} from "./production-request-form";
import { productionRequestsAdminApi } from "@/lib/api/production-requests";
import type { Menu } from "@/lib/api/types";

vi.mock("@/components/admin/menu-picker", () => ({
  MenuPicker: ({
    label = "Menu",
    value,
    onChange,
    error,
    excludeIds = [],
  }: {
    label?: string;
    value: string;
    onChange: (menu: Menu) => void;
    error?: string;
    excludeIds?: string[];
  }) => (
    <div>
      <label htmlFor={`menu-picker-${label}`}>{label}</label>
      <select
        id={`menu-picker-${label}`}
        aria-label={label}
        value={value}
        onChange={(event) => {
          const id = event.target.value;
          if (!id) return;
          onChange({
            id,
            title: id === "menu-a" ? "Nasi Goreng" : "Mie Goreng",
            category_name: "Main",
            category_id: "cat-1",
            available_stock: 10,
            sell_price: 25000,
            recipe_yield: 1,
            margin_percent: 30,
            vat_percent: 11,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          });
        }}
      >
        <option value="">Select</option>
        <option
          value="menu-a"
          disabled={excludeIds.includes("menu-a") && value !== "menu-a"}
        >
          Nasi Goreng
        </option>
        <option
          value="menu-b"
          disabled={excludeIds.includes("menu-b") && value !== "menu-b"}
        >
          Mie Goreng
        </option>
      </select>
      {error && <p>{error}</p>}
    </div>
  ),
}));

vi.mock("@/lib/api/production-requests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/production-requests")>();
  return {
    ...actual,
    productionRequestsAdminApi: {
      ...actual.productionRequestsAdminApi,
      estimate: vi.fn(),
    },
  };
});

const sufficientEstimate = {
  is_fully_producible: true,
  items: [
    {
      menu_id: "menu-a",
      menu_title: "Nasi Goreng",
      quantity: 5,
      stock_estimation: {
        has_formula: true,
        is_fully_producible: true,
        limiting_ingredient_title: "Rice",
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
    },
  ],
  aggregated_ingredients: [
    {
      food_supply_id: "fs-1",
      food_supply_title: "Rice",
      unit: "gr" as const,
      required_quantity: 1000,
      current_stock_quantity: 5000,
      remaining_after: 4000,
      is_sufficient: true,
    },
  ],
};

const insufficientEstimate = {
  is_fully_producible: false,
  items: [
    {
      menu_id: "menu-a",
      menu_title: "Nasi Goreng",
      quantity: 50,
      stock_estimation: {
        has_formula: true,
        is_fully_producible: false,
        limiting_ingredient_title: "Rice",
        ingredients: [
          {
            food_supply_id: "fs-1",
            food_supply_title: "Rice",
            unit: "gr" as const,
            quantity_per_unit: 200,
            required_quantity: 10000,
            current_stock_quantity: 2000,
            remaining_after: -8000,
            is_sufficient: false,
          },
        ],
      },
    },
  ],
  aggregated_ingredients: [
    {
      food_supply_id: "fs-1",
      food_supply_title: "Rice",
      unit: "gr" as const,
      required_quantity: 10000,
      current_stock_quantity: 2000,
      remaining_after: -8000,
      is_sufficient: false,
    },
  ],
};

describe("ProductionRequestForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(productionRequestsAdminApi.estimate).mockResolvedValue({
      data: sufficientEstimate,
    });
  });

  async function addLineItem(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Add line item" }));
  }

  async function selectMenu(
    user: ReturnType<typeof userEvent.setup>,
    label: string,
    menuId: string,
  ) {
    await user.selectOptions(screen.getByLabelText(label), menuId);
  }

  it("renders menu picker and quantity inputs", async () => {
    const user = userEvent.setup();
    render(<ProductionRequestForm onSubmit={() => {}} onCancel={() => {}} />);

    await addLineItem(user);

    expect(screen.getByLabelText("Menu 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantity")).toBeInTheDocument();
    expect(screen.getByLabelText("Notes (optional)")).toBeInTheDocument();
  });

  it("shows green sufficient stock indicator after estimate", async () => {
    const user = userEvent.setup();
    render(<ProductionRequestForm onSubmit={() => {}} onCancel={() => {}} />);

    await addLineItem(user);
    await selectMenu(user, "Menu 1", "menu-a");
    await user.type(screen.getByLabelText("Quantity"), "5");

    await waitFor(() => {
      expect(productionRequestsAdminApi.estimate).toHaveBeenCalledWith({
        items: [{ menu_id: "menu-a", quantity: 5 }],
      });
    });

    expect(
      await screen.findByTestId("production-estimation-overall-badge"),
    ).toHaveTextContent("Sufficient stock");
    expect(
      screen.getByTestId("production-estimation-status-badge-menu-a"),
    ).toHaveTextContent("Sufficient stock");
  });

  it("shows warning indicator and aggregated shortages when stock is insufficient", async () => {
    const user = userEvent.setup();
    vi.mocked(productionRequestsAdminApi.estimate).mockResolvedValue({
      data: insufficientEstimate,
    });

    render(<ProductionRequestForm onSubmit={() => {}} onCancel={() => {}} />);

    await addLineItem(user);
    await selectMenu(user, "Menu 1", "menu-a");
    await user.type(screen.getByLabelText("Quantity"), "50");

    expect(
      await screen.findByTestId("production-estimation-overall-badge"),
    ).toHaveTextContent("Insufficient stock");
    expect(
      screen.getByTestId("production-estimation-limiting-ingredient-menu-a"),
    ).toHaveTextContent("Limiting ingredient: Rice");
    expect(
      screen.getByTestId("production-estimation-aggregated-shortages"),
    ).toBeInTheDocument();

    const submitButton = screen.getByRole("button", {
      name: "Create production request",
    });
    expect(submitButton).toBeEnabled();
  });

  it("shows no-formula warning matching menu stock estimation panel", async () => {
    const user = userEvent.setup();
    vi.mocked(productionRequestsAdminApi.estimate).mockResolvedValue({
      data: {
        is_fully_producible: false,
        items: [
          {
            menu_id: "menu-a",
            menu_title: "Nasi Goreng",
            quantity: 1,
            stock_estimation: {
              has_formula: false,
              is_fully_producible: false,
              message:
                "No ingredient formula saved for this menu. Add and save ingredients first.",
              ingredients: [],
            },
          },
        ],
        aggregated_ingredients: [],
      },
    });

    render(<ProductionRequestForm onSubmit={() => {}} onCancel={() => {}} />);

    await addLineItem(user);
    await selectMenu(user, "Menu 1", "menu-a");
    await user.type(screen.getByLabelText("Quantity"), "1");

    expect(
      await screen.findByTestId("production-estimation-no-formula-menu-a"),
    ).toHaveTextContent(
      "No ingredient formula saved for this menu. Add and save ingredients first.",
    );
  });

  it("applies server item field errors via ref", async () => {
    const user = userEvent.setup();
    const ref = createRef<ProductionRequestFormHandle>();
    render(
      <ProductionRequestForm ref={ref} onSubmit={() => {}} onCancel={() => {}} />,
    );

    await addLineItem(user);
    await waitFor(() => {
      expect(screen.getByLabelText("Menu 1")).toBeInTheDocument();
    });

    ref.current?.applyServerErrors({
      "items[0].menu_id": "Menu is no longer available",
    });

    expect(
      await screen.findByText("Menu is no longer available"),
    ).toBeInTheDocument();
  });

  it("blocks submit when no line items are present", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ProductionRequestForm onSubmit={onSubmit} onCancel={() => {}} />);

    const submitButton = screen.getByRole("button", {
      name: "Create production request",
    });
    expect(submitButton).toBeDisabled();
    await user.click(submitButton);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
