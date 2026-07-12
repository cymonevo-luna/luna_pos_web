import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SupplierPriceForm } from "./supplier-price-form";

vi.mock("@/components/admin/food-supply-picker", () => ({
  FoodSupplyPicker: ({
    label = "Food supply",
    value,
    onChange,
    error,
  }: {
    label?: string;
    value: string;
    onChange: (supply: {
      id: string;
      title: string;
      unit: "gr" | "ml" | "piece";
      stock_quantity: number;
    }) => void;
    error?: string;
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
      {error && <p>{error}</p>}
    </div>
  ),
}));

describe("SupplierPriceForm", () => {
  it("shows unit read-only after selecting a food supply", async () => {
    const user = userEvent.setup();

    render(<SupplierPriceForm onSubmit={() => {}} onCancel={() => {}} />);

    await user.selectOptions(screen.getByLabelText("Food supply"), "fs-1");

    expect(screen.getByLabelText("Unit")).toHaveValue("gr");
  });

  it("shows computed unit price preview", async () => {
    const user = userEvent.setup();

    render(<SupplierPriceForm onSubmit={() => {}} onCancel={() => {}} />);

    await user.selectOptions(screen.getByLabelText("Food supply"), "fs-1");
    await user.type(screen.getByLabelText("Price amount (Rp)"), "140000");
    await user.type(screen.getByLabelText("Price quantity"), "1000");

    expect(screen.getByText(/Unit price preview:/)).toBeInTheDocument();
    expect(screen.getByText(/Rp 140 \/ gr/)).toBeInTheDocument();
  });

  it("submits valid price values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <SupplierPriceForm
        onSubmit={onSubmit}
        onCancel={() => {}}
        submitLabel="Add price"
      />,
    );

    await user.selectOptions(screen.getByLabelText("Food supply"), "fs-1");
    await user.type(screen.getByLabelText("Price amount (Rp)"), "140000");
    await user.type(screen.getByLabelText("Price quantity"), "1000");
    await user.click(screen.getByRole("button", { name: "Add price" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      food_supply_id: "fs-1",
      price_amount: 140000,
      price_quantity: 1000,
    });
  });
});
