import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SupplierForm } from "./supplier-form";
import { foodSuppliesAdminApi } from "@/lib/api/food-supplies";

vi.mock("@/lib/api/food-supplies", () => ({
  foodSuppliesAdminApi: {
    list: vi.fn(),
  },
}));

const mockFoodSupplies = [
  {
    id: "fs-1",
    title: "Rice",
    description: null,
    stock_quantity: 100,
    unit: "gr" as const,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "fs-2",
    title: "Cooking oil",
    description: null,
    stock_quantity: 50,
    unit: "ml" as const,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

describe("SupplierForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(foodSuppliesAdminApi.list).mockResolvedValue({
      data: mockFoodSupplies,
      meta: { page: 1, per_page: 100, total: 2 },
    });
  });

  it("renders all base fields", async () => {
    render(<SupplierForm onSubmit={() => {}} onCancel={() => {}} />);

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone number")).toBeInTheDocument();
    expect(screen.getByLabelText("Address")).toBeInTheDocument();
    expect(screen.getByLabelText("Supports delivery")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add food item" }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(foodSuppliesAdminApi.list).toHaveBeenCalledWith({
        page: 1,
        perPage: 100,
      });
    });
  });

  it("toggles delivery cost visibility with supports delivery", async () => {
    const user = userEvent.setup();

    render(<SupplierForm onSubmit={() => {}} onCancel={() => {}} />);

    expect(screen.queryByLabelText("Delivery cost (Rp)")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Supports delivery"));
    expect(screen.getByLabelText("Delivery cost (Rp)")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Supports delivery"));
    expect(screen.queryByLabelText("Delivery cost (Rp)")).not.toBeInTheDocument();
  });

  it("adds and removes food item rows", async () => {
    const user = userEvent.setup();

    render(<SupplierForm onSubmit={() => {}} onCancel={() => {}} />);
    await waitFor(() => {
      expect(foodSuppliesAdminApi.list).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("button", { name: "Add food item" }));
    await user.click(screen.getByRole("button", { name: "Add food item" }));
    expect(screen.getAllByLabelText("Food supply")).toHaveLength(2);

    await user.click(screen.getByLabelText("Remove food item 1"));
    expect(screen.getAllByLabelText("Food supply")).toHaveLength(1);
  });

  it("sets unit label when a food supply is selected", async () => {
    const user = userEvent.setup();

    render(<SupplierForm onSubmit={() => {}} onCancel={() => {}} />);
    await waitFor(() => {
      expect(foodSuppliesAdminApi.list).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("button", { name: "Add food item" }));
    await user.selectOptions(screen.getByLabelText("Food supply"), "fs-1");

    expect(screen.getByText("Gram")).toBeInTheDocument();
  });

  it("submits valid values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <SupplierForm
        onSubmit={onSubmit}
        onCancel={() => {}}
        submitLabel="Save supplier"
      />,
    );
    await waitFor(() => {
      expect(foodSuppliesAdminApi.list).toHaveBeenCalled();
    });

    await user.type(screen.getByLabelText("Name"), "Beras Supplier");
    await user.type(screen.getByLabelText("Phone number"), "08123456789");
    await user.type(screen.getByLabelText("Address"), "Jl. Pasar 12");

    await user.click(screen.getByRole("button", { name: "Add food item" }));
    await user.selectOptions(screen.getByLabelText("Food supply"), "fs-1");
    await user.type(screen.getByLabelText("Price (Rp)"), "10000");
    await user.type(screen.getByLabelText("Quantity"), "2");

    await user.click(screen.getByRole("button", { name: "Save supplier" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: "Beras Supplier",
        phone_number: "08123456789",
        address: "Jl. Pasar 12",
        supports_delivery: false,
        delivery_cost: undefined,
        food_items: [
          {
            food_supply_id: "fs-1",
            price: 10000,
            quantity: 2,
            unit: "gr",
          },
        ],
      });
    });
  });

  it("blocks submit when name is empty", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<SupplierForm onSubmit={onSubmit} onCancel={() => {}} />);
    await waitFor(() => {
      expect(foodSuppliesAdminApi.list).toHaveBeenCalled();
    });

    await user.type(screen.getByLabelText("Phone number"), "08123456789");
    await user.type(screen.getByLabelText("Address"), "Jl. Pasar 12");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(/Name must be at least/),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks submit when delivery is enabled without delivery cost", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<SupplierForm onSubmit={onSubmit} onCancel={() => {}} />);
    await waitFor(() => {
      expect(foodSuppliesAdminApi.list).toHaveBeenCalled();
    });

    await user.type(screen.getByLabelText("Name"), "Beras Supplier");
    await user.type(screen.getByLabelText("Phone number"), "08123456789");
    await user.type(screen.getByLabelText("Address"), "Jl. Pasar 12");
    await user.click(screen.getByLabelText("Supports delivery"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(
        "Delivery cost is required when delivery is supported",
      ),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
