import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SmartPurchaseRequestWizard } from "./smart-purchase-request-wizard";
import { purchaseRequestsAdminApi } from "@/lib/api/purchase-requests";
import { foodSuppliesAdminApi } from "@/lib/api/food-supplies";
import type { FoodSupply } from "@/lib/api/types";

vi.mock("@/components/admin/food-supply-picker", () => ({
  FoodSupplyPicker: ({
    label = "Food supply",
    value,
    onChange,
    error,
    excludeIds = [],
  }: {
    label?: string;
    value: string;
    onChange: (supply: FoodSupply) => void;
    error?: string;
    excludeIds?: string[];
  }) => (
    <div>
      <label htmlFor={`food-picker-${label}`}>{label}</label>
      <select
        id={`food-picker-${label}`}
        aria-label={label}
        value={value}
        onChange={(event) => {
          const id = event.target.value;
          if (!id) return;
          onChange({
            id,
            title: id === "fs-rice" ? "Rice" : "Salt",
            unit: "gr",
            stock_quantity: 1000,
            has_supplier_price: true,
            description: null,
            manual_edit_history: [],
            cooking_measurements: [],
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          });
        }}
      >
        <option value="">Select</option>
        <option
          value="fs-rice"
          disabled={excludeIds.includes("fs-rice") && value !== "fs-rice"}
        >
          Rice
        </option>
        <option
          value="fs-salt"
          disabled={excludeIds.includes("fs-salt") && value !== "fs-salt"}
        >
          Salt
        </option>
      </select>
      {error && <p>{error}</p>}
    </div>
  ),
}));

vi.mock("@/lib/api/purchase-requests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/purchase-requests")>();
  return {
    ...actual,
    purchaseRequestsAdminApi: {
      ...actual.purchaseRequestsAdminApi,
      suggest: vi.fn(),
      batch: vi.fn(),
    },
  };
});

vi.mock("@/lib/api/food-supplies", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/food-supplies")>();
  return {
    ...actual,
    foodSuppliesAdminApi: {
      ...actual.foodSuppliesAdminApi,
      listSupplierPrices: vi.fn(),
    },
  };
});

const suggestResponse = {
  items: [
    {
      food_supply_id: "fs-rice",
      food_supply_title: "Rice",
      quantity: 2,
      unit: "gr" as const,
      has_supplier_price: true,
      selected_supplier_id: "sup-cheap",
      selected_supplier_name: "Cheap Supplier",
      price_amount: 100000,
      price_quantity: 1000,
      unit_price: 100,
      line_estimated_amount: 200,
      all_supplier_quotes: [
        {
          supplier_id: "sup-cheap",
          supplier_name: "Cheap Supplier",
          price_amount: 100000,
          price_quantity: 1000,
          unit_price: 100,
        },
        {
          supplier_id: "sup-expensive",
          supplier_name: "Expensive Supplier",
          price_amount: 150000,
          price_quantity: 1000,
          unit_price: 150,
        },
      ],
    },
    {
      food_supply_id: "fs-salt",
      food_supply_title: "Salt",
      quantity: 1,
      unit: "gr" as const,
      has_supplier_price: true,
      selected_supplier_id: "sup-cheap",
      selected_supplier_name: "Cheap Supplier",
      price_amount: 5000,
      price_quantity: 1000,
      unit_price: 5,
      line_estimated_amount: 5,
      all_supplier_quotes: [
        {
          supplier_id: "sup-cheap",
          supplier_name: "Cheap Supplier",
          price_amount: 5000,
          price_quantity: 1000,
          unit_price: 5,
        },
      ],
    },
  ],
  grouped_by_supplier: [],
};

describe("SmartPurchaseRequestWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(purchaseRequestsAdminApi.suggest).mockResolvedValue({
      data: suggestResponse,
    });
    vi.mocked(purchaseRequestsAdminApi.batch).mockResolvedValue({
      data: { purchase_requests: [] },
    });
    vi.mocked(foodSuppliesAdminApi.listSupplierPrices).mockResolvedValue({
      data: [],
    });
  });

  async function addIngredient(
    user: ReturnType<typeof userEvent.setup>,
    label: string,
    supplyId: string,
    quantity: string,
  ) {
    await user.selectOptions(screen.getByLabelText(label), supplyId);
    const quantityInputs = screen.getAllByLabelText("Quantity");
    await user.clear(quantityInputs[quantityInputs.length - 1]!);
    await user.type(quantityInputs[quantityInputs.length - 1]!, quantity);
  }

  it("calls suggest and renders review step", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(
      <SmartPurchaseRequestWizard onCancel={vi.fn()} onSuccess={onSuccess} />,
    );

    await user.click(screen.getByRole("button", { name: /add ingredient/i }));
    await addIngredient(user, "Ingredient 1", "fs-rice", "2");
    await user.click(screen.getByRole("button", { name: /add ingredient/i }));
    await addIngredient(user, "Ingredient 2", "fs-salt", "1");

    await user.click(screen.getByTestId("smart-purchase-continue"));

    await waitFor(() => {
      expect(purchaseRequestsAdminApi.suggest).toHaveBeenCalledWith({
        items: [
          { food_supply_id: "fs-rice", quantity: "2" },
          { food_supply_id: "fs-salt", quantity: "1" },
        ],
      });
    });

    expect(screen.getByTestId("smart-purchase-review-step")).toBeInTheDocument();
    expect(screen.getByTestId("supplier-group-sup-cheap")).toBeInTheDocument();
  });

  it("shows cheapest supplier pre-selected with line total", async () => {
    const user = userEvent.setup();

    render(
      <SmartPurchaseRequestWizard onCancel={vi.fn()} onSuccess={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /add ingredient/i }));
    await addIngredient(user, "Ingredient 1", "fs-rice", "2");
    await user.click(screen.getByTestId("smart-purchase-continue"));

    await waitFor(() => {
      expect(screen.getByTestId("review-item-fs-rice")).toBeInTheDocument();
    });

    expect(screen.getByTestId("supplier-select-fs-rice")).toHaveValue("sup-cheap");
    expect(screen.getByTestId("line-total-fs-rice")).toHaveTextContent("Rp 200");
  });

  it("updates line total and regroups when supplier changes", async () => {
    const user = userEvent.setup();

    render(
      <SmartPurchaseRequestWizard onCancel={vi.fn()} onSuccess={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /add ingredient/i }));
    await addIngredient(user, "Ingredient 1", "fs-rice", "2");
    await user.click(screen.getByTestId("smart-purchase-continue"));

    await waitFor(() => {
      expect(screen.getByTestId("supplier-select-fs-rice")).toBeInTheDocument();
    });

    await user.selectOptions(
      screen.getByTestId("supplier-select-fs-rice"),
      "sup-expensive",
    );

    expect(screen.getByTestId("line-total-fs-rice")).toHaveTextContent("Rp 300");
    expect(screen.getByTestId("supplier-group-sup-expensive")).toBeInTheDocument();
  });

  it("shows actual price input and catalog update toggle on review step", async () => {
    const user = userEvent.setup();

    render(
      <SmartPurchaseRequestWizard onCancel={vi.fn()} onSuccess={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /add ingredient/i }));
    await addIngredient(user, "Ingredient 1", "fs-rice", "2");
    await user.click(screen.getByTestId("smart-purchase-continue"));

    await waitFor(() => {
      expect(screen.getByTestId("review-item-fs-rice")).toBeInTheDocument();
    });

    expect(screen.getByTestId("actual-price-fs-rice")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-update-fs-rice")).toBeInTheDocument();
  });

  it("submits batch payload with line_actual_amount when filled", async () => {
    vi.mocked(purchaseRequestsAdminApi.suggest).mockResolvedValue({
      data: {
        items: [suggestResponse.items[0]!],
        grouped_by_supplier: [],
      },
    });

    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(
      <SmartPurchaseRequestWizard onCancel={vi.fn()} onSuccess={onSuccess} />,
    );

    await user.click(screen.getByRole("button", { name: /add ingredient/i }));
    await addIngredient(user, "Ingredient 1", "fs-rice", "2");
    await user.click(screen.getByTestId("smart-purchase-continue"));

    await waitFor(() => {
      expect(screen.getByTestId("actual-price-fs-rice")).toBeInTheDocument();
    });

    await user.clear(screen.getByTestId("actual-price-fs-rice"));
    await user.type(screen.getByTestId("actual-price-fs-rice"), "175");
    await user.click(screen.getByTestId("smart-purchase-confirm"));

    await waitFor(() => {
      expect(purchaseRequestsAdminApi.batch).toHaveBeenCalledWith({
        groups: [
          {
            supplier_id: "sup-cheap",
            items: [
              {
                food_supply_id: "fs-rice",
                quantity: "2",
                line_actual_amount: "175",
              },
            ],
          },
        ],
      });
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("resets catalog price fields when supplier changes", async () => {
    const user = userEvent.setup();

    render(
      <SmartPurchaseRequestWizard onCancel={vi.fn()} onSuccess={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /add ingredient/i }));
    await addIngredient(user, "Ingredient 1", "fs-rice", "2");
    await user.click(screen.getByTestId("smart-purchase-continue"));

    await waitFor(() => {
      expect(screen.getByTestId("catalog-update-fs-rice")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("catalog-update-fs-rice"));
    await user.clear(screen.getByTestId("catalog-price-amount-fs-rice"));
    await user.type(screen.getByTestId("catalog-price-amount-fs-rice"), "99999");
    await user.clear(screen.getByTestId("catalog-price-quantity-fs-rice"));
    await user.type(screen.getByTestId("catalog-price-quantity-fs-rice"), "500");

    await user.selectOptions(
      screen.getByTestId("supplier-select-fs-rice"),
      "sup-expensive",
    );

    expect(screen.getByTestId("catalog-update-fs-rice")).not.toBeChecked();
    await user.click(screen.getByTestId("catalog-update-fs-rice"));
    expect(screen.getByTestId("catalog-price-amount-fs-rice")).toHaveValue(150000);
    expect(screen.getByTestId("catalog-price-quantity-fs-rice")).toHaveValue(1000);
  });

  it("updates displayed totals when actual price is entered", async () => {
    vi.mocked(purchaseRequestsAdminApi.suggest).mockResolvedValue({
      data: {
        items: [suggestResponse.items[0]!],
        grouped_by_supplier: [],
      },
    });

    const user = userEvent.setup();

    render(
      <SmartPurchaseRequestWizard onCancel={vi.fn()} onSuccess={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /add ingredient/i }));
    await addIngredient(user, "Ingredient 1", "fs-rice", "2");
    await user.click(screen.getByTestId("smart-purchase-continue"));

    await waitFor(() => {
      expect(screen.getByTestId("line-total-fs-rice")).toHaveTextContent("Rp 200");
    });

    fireEvent.change(screen.getByTestId("actual-price-fs-rice"), {
      target: { value: "175" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("line-total-fs-rice")).toHaveTextContent("Rp 175");
      expect(screen.getByTestId("group-total-sup-cheap")).toHaveTextContent("Rp 175");
      expect(screen.getByTestId("smart-purchase-grand-total")).toHaveTextContent(
        "Rp 175",
      );
    });
  });

  it("submits batch payload on confirm", async () => {
    vi.mocked(purchaseRequestsAdminApi.suggest).mockResolvedValue({
      data: {
        items: [suggestResponse.items[0]!],
        grouped_by_supplier: [],
      },
    });

    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(
      <SmartPurchaseRequestWizard onCancel={vi.fn()} onSuccess={onSuccess} />,
    );

    await user.click(screen.getByRole("button", { name: /add ingredient/i }));
    await addIngredient(user, "Ingredient 1", "fs-rice", "2");
    await user.click(screen.getByTestId("smart-purchase-continue"));

    await waitFor(() => {
      expect(screen.getByTestId("smart-purchase-confirm")).toBeEnabled();
    });

    await user.click(screen.getByTestId("smart-purchase-confirm"));

    await waitFor(() => {
      expect(purchaseRequestsAdminApi.batch).toHaveBeenCalledWith({
        groups: [
          {
            supplier_id: "sup-cheap",
            items: [{ food_supply_id: "fs-rice", quantity: "2" }],
          },
        ],
      });
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("blocks confirm for unmatched items until supplier is selected", async () => {
    vi.mocked(purchaseRequestsAdminApi.suggest).mockResolvedValue({
      data: {
        items: [
          {
            ...suggestResponse.items[0]!,
            has_supplier_price: false,
            selected_supplier_id: null,
            selected_supplier_name: null,
            line_estimated_amount: 0,
            all_supplier_quotes: [],
          },
        ],
        grouped_by_supplier: [],
      },
    });
    vi.mocked(foodSuppliesAdminApi.listSupplierPrices).mockResolvedValue({
      data: [
        {
          id: "price-1",
          supplier_id: "sup-manual",
          supplier_name: "Manual Supplier",
          food_supply_id: "fs-rice",
          unit: "gr",
          price_amount: 100000,
          price_quantity: 1000,
        },
      ],
    });

    const user = userEvent.setup();

    render(
      <SmartPurchaseRequestWizard onCancel={vi.fn()} onSuccess={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /add ingredient/i }));
    await addIngredient(user, "Ingredient 1", "fs-rice", "2");
    await user.click(screen.getByTestId("smart-purchase-continue"));

    await waitFor(() => {
      expect(screen.getByTestId("unmatched-supplier-badge")).toBeInTheDocument();
    });

    expect(screen.getByTestId("smart-purchase-confirm")).toBeDisabled();

    await user.selectOptions(
      screen.getByTestId("supplier-select-fs-rice"),
      "sup-manual",
    );

    expect(screen.getByTestId("smart-purchase-confirm")).toBeEnabled();
  });
});
