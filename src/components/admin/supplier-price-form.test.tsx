import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SupplierPriceForm } from "./supplier-price-form";

const MOCK_SUPPLIES = {
  "fs-gr": { id: "fs-gr", title: "Rice", unit: "gr" as const, stock_quantity: 100 },
  "fs-ml": { id: "fs-ml", title: "Milk", unit: "ml" as const, stock_quantity: 500 },
  "fs-piece": {
    id: "fs-piece",
    title: "Egg",
    unit: "piece" as const,
    stock_quantity: 24,
  },
} as const;

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
          const supply = MOCK_SUPPLIES[id as keyof typeof MOCK_SUPPLIES];
          if (supply) onChange(supply);
        }}
      >
        <option value="">Select</option>
        <option value="fs-gr">Rice</option>
        <option value="fs-ml">Milk</option>
        <option value="fs-piece">Egg</option>
      </select>
      {error && <p>{error}</p>}
    </div>
  ),
}));

describe("SupplierPriceForm", () => {
  it("shows unit read-only after selecting a food supply", async () => {
    const user = userEvent.setup();

    render(<SupplierPriceForm onSubmit={() => {}} onCancel={() => {}} />);

    await user.selectOptions(screen.getByLabelText("Food supply"), "fs-gr");

    expect(screen.getByLabelText("Unit")).toHaveValue("gr");
  });

  it.each([
    { supplyId: "fs-ml", expectedUnit: "ml" },
    { supplyId: "fs-piece", expectedUnit: "pcs" },
  ])(
    "shows short unit label $expectedUnit for $supplyId",
    async ({ supplyId, expectedUnit }) => {
      const user = userEvent.setup();

      render(<SupplierPriceForm onSubmit={() => {}} onCancel={() => {}} />);

      await user.selectOptions(screen.getByLabelText("Food supply"), supplyId);

      expect(screen.getByLabelText("Unit")).toHaveValue(expectedUnit);
    },
  );

  it("shows computed unit price preview", async () => {
    const user = userEvent.setup();

    render(<SupplierPriceForm onSubmit={() => {}} onCancel={() => {}} />);

    await user.selectOptions(screen.getByLabelText("Food supply"), "fs-gr");
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

    await user.selectOptions(screen.getByLabelText("Food supply"), "fs-gr");
    await user.type(screen.getByLabelText("Price amount (Rp)"), "140000");
    await user.type(screen.getByLabelText("Price quantity"), "1000");
    await user.click(screen.getByRole("button", { name: "Add price" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      food_supply_id: "fs-gr",
      price_amount: 140000,
      price_quantity: 1000,
    });
  });
});
