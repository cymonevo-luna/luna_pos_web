import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRef } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  PurchaseRequestForm,
  type PurchaseRequestFormHandle,
} from "./purchase-request-form";
import { suppliersAdminApi } from "@/lib/api/suppliers";
import type { Supplier, SupplierPrice } from "@/lib/api/types";

vi.mock("@/components/admin/supplier-picker", () => ({
  SupplierPicker: ({
    label = "Supplier",
    value,
    onChange,
    error,
  }: {
    label?: string;
    value: string;
    onChange: (supplier: Supplier) => void;
    error?: string;
  }) => (
    <div>
      <label htmlFor="supplier-picker">{label}</label>
      <select
        id="supplier-picker"
        aria-label={label}
        value={value}
        onChange={(event) => {
          const id = event.target.value;
          if (!id) return;
          onChange({
            id,
            name: id === "sup-a" ? "Supplier A" : "Supplier B",
            phone_number: "08123456789",
            address: "Address",
            supports_delivery: false,
            delivery_cost: null,
            price_quotes: [],
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          });
        }}
      >
        <option value="">Select</option>
        <option value="sup-a">Supplier A</option>
        <option value="sup-b">Supplier B</option>
      </select>
      {error && <p>{error}</p>}
    </div>
  ),
}));

vi.mock("@/lib/api/suppliers", () => ({
  suppliersAdminApi: {
    get: vi.fn(),
  },
}));

const meatPrice: SupplierPrice = {
  id: "price-1",
  food_supply_id: "fs-meat",
  food_supply_title: "Meat",
  unit: "gr",
  price_amount: 140000,
  price_quantity: 1000,
};

const saltPrice: SupplierPrice = {
  id: "price-2",
  food_supply_id: "fs-salt",
  food_supply_title: "Salt",
  unit: "gr",
  price_amount: 5000,
  price_quantity: 1000,
};

describe("PurchaseRequestForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(suppliersAdminApi.get).mockImplementation(async (id) => ({
      data: {
        id,
        name: id === "sup-a" ? "Supplier A" : "Supplier B",
        phone_number: "08123456789",
        address: "Address",
        supports_delivery: false,
        delivery_cost: null,
        price_quotes: id === "sup-a" ? [meatPrice] : [saltPrice],
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      meta: undefined,
    }));
  });

  async function selectSupplier(user: ReturnType<typeof userEvent.setup>, id: string) {
    await user.selectOptions(screen.getByLabelText("Supplier"), id);
    await waitFor(() => {
      expect(suppliersAdminApi.get).toHaveBeenCalledWith(id);
    });
  }

  async function addLineItem(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Add line item" }));
  }

  it("clears line items when supplier changes", async () => {
    const user = userEvent.setup();
    render(<PurchaseRequestForm onSubmit={() => {}} onCancel={() => {}} />);

    await selectSupplier(user, "sup-a");
    await addLineItem(user);

    const itemSelect = await screen.findByLabelText("Item 1");
    await user.selectOptions(itemSelect, "fs-meat");
    await user.type(screen.getByLabelText("Quantity"), "1000");

    expect(screen.getByText(/Meat · 1000 gr/)).toBeInTheDocument();

    await selectSupplier(user, "sup-b");

    expect(screen.queryByLabelText("Item 1")).not.toBeInTheDocument();
    expect(screen.queryByText(/Meat · 1000 gr/)).not.toBeInTheDocument();
  });

  it("recalculates summary when quantities change", async () => {
    const user = userEvent.setup();
    render(<PurchaseRequestForm onSubmit={() => {}} onCancel={() => {}} />);

    await selectSupplier(user, "sup-a");
    await addLineItem(user);

    const itemSelect = await screen.findByLabelText("Item 1");
    await user.selectOptions(itemSelect, "fs-meat");
    await user.type(screen.getByLabelText("Quantity"), "1000");

    expect(await screen.findByText(/Meat · 1000 gr/)).toBeInTheDocument();
    const amounts = screen.getAllByText("Rp 140.000");
    expect(amounts.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText("Estimated total")).toContainElement(amounts[amounts.length - 1]!);
  });

  it("applies server item field errors via ref", async () => {
    const user = userEvent.setup();
    const ref = createRef<PurchaseRequestFormHandle>();
    render(
      <PurchaseRequestForm ref={ref} onSubmit={() => {}} onCancel={() => {}} />,
    );

    await selectSupplier(user, "sup-a");
    await addLineItem(user);
    await waitFor(() => {
      expect(screen.getByLabelText("Item 1")).toBeInTheDocument();
    });

    ref.current?.applyServerErrors({
      "items[0].food_supply_id": "Item is no longer in supplier catalog",
    });

    expect(
      await screen.findByText("Item is no longer in supplier catalog"),
    ).toBeInTheDocument();
  });

  it("blocks submit when no line items are present", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PurchaseRequestForm onSubmit={onSubmit} onCancel={() => {}} />);

    await selectSupplier(user, "sup-a");

    const submitButton = screen.getByRole("button", {
      name: "Create purchase request",
    });
    expect(submitButton).toBeDisabled();
    await user.click(submitButton);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
