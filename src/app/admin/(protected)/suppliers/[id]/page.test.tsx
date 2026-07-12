import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminSupplierDetailContent } from "./supplier-detail-content";
import { suppliersAdminApi } from "@/lib/api/suppliers";
import type { Supplier } from "@/lib/api/types";
import { toast } from "sonner";

vi.mock("@/lib/api/suppliers", () => ({
  suppliersAdminApi: {
    get: vi.fn(),
    createPrice: vi.fn(),
    updatePrice: vi.fn(),
    deletePrice: vi.fn(),
  },
  supplierPriceFormToPayload: vi.fn((values) => values),
}));

vi.mock("@/components/admin/food-supply-picker", () => ({
  FoodSupplyPicker: ({
    label = "Food supply",
    value,
    onChange,
  }: {
    label?: string;
    value: string;
    onChange: (supply: {
      id: string;
      title: string;
      unit: "gr";
      stock_quantity: number;
    }) => void;
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
            title: "Rice",
            unit: "gr",
            stock_quantity: 100,
          });
        }}
      >
        <option value="">Select</option>
        <option value="fs-1">Rice</option>
      </select>
    </div>
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const supplier: Supplier = {
  id: "sup-1",
  name: "Beras Supplier",
  phone_number: "08123456789",
  address: "Jl. Pasar 12",
  supports_delivery: false,
  delivery_cost: null,
  price_quotes: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("AdminSupplierDetailContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(suppliersAdminApi.get).mockResolvedValue({ data: supplier });
  });

  it("renders supplier detail and empty price quotes", async () => {
    render(<AdminSupplierDetailContent id="sup-1" />);

    expect(await screen.findByText("Beras Supplier")).toBeInTheDocument();
    expect(screen.getByText("No price quotes yet.")).toBeInTheDocument();
  });

  it("adds a price quote from the modal", async () => {
    const user = userEvent.setup();
    vi.mocked(suppliersAdminApi.createPrice).mockResolvedValue({
      data: {
        id: "price-1",
        food_supply_id: "fs-1",
        food_supply_title: "Rice",
        price_amount: 140000,
        price_quantity: 1000,
        unit: "gr",
        unit_price: 140,
      },
    });
    vi.mocked(suppliersAdminApi.get)
      .mockResolvedValueOnce({ data: supplier })
      .mockResolvedValueOnce({
        data: {
          ...supplier,
          price_quotes: [
            {
              id: "price-1",
              food_supply_id: "fs-1",
              food_supply_title: "Rice",
              price_amount: 140000,
              price_quantity: 1000,
              unit: "gr",
              unit_price: 140,
            },
          ],
        },
      });

    render(<AdminSupplierDetailContent id="sup-1" />);
    await screen.findByText("Beras Supplier");

    await user.click(screen.getByRole("button", { name: "Add price" }));
    const dialog = screen.getByRole("dialog");

    await user.selectOptions(
      within(dialog).getByLabelText("Food supply"),
      "fs-1",
    );
    await user.type(
      within(dialog).getByLabelText("Price amount (Rp)"),
      "140000",
    );
    await user.type(
      within(dialog).getByLabelText("Price quantity"),
      "1000",
    );
    await user.click(within(dialog).getByRole("button", { name: "Add price" }));

    await waitFor(() => {
      expect(suppliersAdminApi.createPrice).toHaveBeenCalledWith("sup-1", {
        food_supply_id: "fs-1",
        price_amount: 140000,
        price_quantity: 1000,
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Price quote added");
  });
});
