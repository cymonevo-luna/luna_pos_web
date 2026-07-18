import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminSupplierDetailContent } from "./supplier-detail-content";
import { suppliersAdminApi } from "@/lib/api/suppliers";
import { ApiError } from "@/lib/api/client";
import type { Supplier, SupplierPrice } from "@/lib/api/types";
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

const priceQuote: SupplierPrice = {
  id: "price-1",
  food_supply_id: "fs-1",
  food_supply_title: "Rice",
  price_amount: 140000,
  price_quantity: 1000,
  unit: "gr",
  unit_price: 140,
};

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

const supplierWithPrices: Supplier = {
  ...supplier,
  price_quotes: [priceQuote],
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

  it("renders supplier detail without phone in header when phone is blank", async () => {
    vi.mocked(suppliersAdminApi.get).mockResolvedValue({
      data: { ...supplier, phone_number: "" },
    });

    render(<AdminSupplierDetailContent id="sup-1" />);

    expect(await screen.findByText("Beras Supplier")).toBeInTheDocument();
    expect(screen.getByText("Jl. Pasar 12")).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
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

  it("deletes a price quote after confirmation and refetches supplier detail", async () => {
    const user = userEvent.setup();
    vi.mocked(suppliersAdminApi.deletePrice).mockResolvedValue({
      data: undefined,
    });
    vi.mocked(suppliersAdminApi.get)
      .mockResolvedValueOnce({ data: supplierWithPrices })
      .mockResolvedValueOnce({ data: supplier });

    render(<AdminSupplierDetailContent id="sup-1" />);
    await screen.findByText("Rice");

    await user.click(screen.getByLabelText("Delete price quote"));
    expect(screen.getByText("Delete price quote")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(suppliersAdminApi.deletePrice).toHaveBeenCalledWith("price-1");
    });
    expect(toast.success).toHaveBeenCalledWith("Price quote deleted");
    await waitFor(() => {
      expect(suppliersAdminApi.get).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText("Rice")).not.toBeInTheDocument();
    expect(screen.getByText("No price quotes yet.")).toBeInTheDocument();
  });

  it("shows API error message when price delete fails", async () => {
    const user = userEvent.setup();
    vi.mocked(suppliersAdminApi.get).mockResolvedValue({
      data: supplierWithPrices,
    });
    vi.mocked(suppliersAdminApi.deletePrice).mockRejectedValue(
      new ApiError(500, "server_error", "Cannot delete supplier price"),
    );

    render(<AdminSupplierDetailContent id="sup-1" />);
    await screen.findByText("Rice");

    await user.click(screen.getByLabelText("Delete price quote"));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Cannot delete supplier price");
    });
    expect(screen.getByRole("cell", { name: "Rice" })).toBeInTheDocument();
  });

  it("edits a price quote from the modal", async () => {
    const user = userEvent.setup();
    vi.mocked(suppliersAdminApi.get)
      .mockResolvedValueOnce({ data: supplierWithPrices })
      .mockResolvedValueOnce({
        data: {
          ...supplierWithPrices,
          price_quotes: [
            {
              ...priceQuote,
              price_amount: 150000,
              unit_price: 150,
            },
          ],
        },
      });
    vi.mocked(suppliersAdminApi.updatePrice).mockResolvedValue({
      data: {
        ...priceQuote,
        price_amount: 150000,
        unit_price: 150,
      },
    });

    render(<AdminSupplierDetailContent id="sup-1" />);
    await screen.findByText("Rice");

    await user.click(screen.getByLabelText("Edit price quote"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Price amount (Rp)")).toHaveValue(
      140000,
    );

    const amountInput = within(dialog).getByLabelText("Price amount (Rp)");
    await user.clear(amountInput);
    await user.type(amountInput, "150000");
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    await waitFor(() => {
      expect(suppliersAdminApi.updatePrice).toHaveBeenCalledWith("price-1", {
        food_supply_id: "fs-1",
        price_amount: 150000,
        price_quantity: 1000,
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Price quote updated");
  });
});
