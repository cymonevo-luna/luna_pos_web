import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminSuppliersPage from "./page";
import { suppliersAdminApi } from "@/lib/api/suppliers";
import { foodSuppliesAdminApi } from "@/lib/api/food-supplies";
import { ApiError } from "@/lib/api/client";
import type { Supplier } from "@/lib/api/types";
import { toast } from "sonner";

vi.mock("@/lib/api/suppliers", () => ({
  suppliersAdminApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  supplierFormToPayload: vi.fn((values) => ({
    name: values.name,
    phone_number: values.phone_number.trim(),
    address: values.address,
    supports_delivery: values.supports_delivery,
    delivery_cost: values.supports_delivery ? (values.delivery_cost ?? 0) : 0,
    food_items: values.food_items.map(
      (item: {
        food_supply_id: string;
        price: number;
        quantity: number;
        unit: string;
      }) => ({
        food_supply_id: item.food_supply_id,
        price: item.price,
        quantity: item.quantity,
        unit: item.unit,
      }),
    ),
  })),
}));

vi.mock("@/lib/api/food-supplies", () => ({
  foodSuppliesAdminApi: {
    list: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
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

const supplier: Supplier = {
  id: "sup-1",
  name: "Beras Supplier",
  phone_number: "08123456789",
  address: "Jl. Pasar 12",
  supports_delivery: true,
  delivery_cost: 15000,
  food_items: [
    {
      food_supply_id: "fs-1",
      food_supply_title: "Rice",
      price: 84000,
      quantity: 5000,
      unit: "gr",
    },
    {
      food_supply_id: "fs-2",
      food_supply_title: "Cooking oil",
      price: 25000,
      quantity: 1000,
      unit: "ml",
    },
  ],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

describe("AdminSuppliersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(suppliersAdminApi.list).mockResolvedValue({
      data: [supplier],
      meta: { page: 1, per_page: 10, total: 1 },
    });
    vi.mocked(foodSuppliesAdminApi.list).mockResolvedValue({
      data: mockFoodSupplies,
      meta: { page: 1, per_page: 100, total: 2 },
    });
  });

  it("renders suppliers from the API", async () => {
    render(<AdminSuppliersPage />);

    expect(await screen.findByText("Beras Supplier")).toBeInTheDocument();
    expect(screen.getByText("08123456789")).toBeInTheDocument();
    expect(screen.getByText("Jl. Pasar 12")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1 total")).toBeInTheDocument();
  });

  it("displays delivery badge and food item preview", async () => {
    render(<AdminSuppliersPage />);

    await screen.findByText("Beras Supplier");
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("Rp 15.000")).toBeInTheDocument();
    expect(
      screen.getByText("Rice — Rp 84.000 / 5000 gr +1 more"),
    ).toBeInTheDocument();
  });

  it("shows empty state when no suppliers match", async () => {
    vi.mocked(suppliersAdminApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 10, total: 0 },
    });

    render(<AdminSuppliersPage />);

    expect(await screen.findByText("No suppliers found.")).toBeInTheDocument();
  });

  it("debounces search and reloads with the search term", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<AdminSuppliersPage />);
    await screen.findByText("Beras Supplier");

    await user.type(
      screen.getByPlaceholderText("Search name, phone, or address"),
      "beras",
    );
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(suppliersAdminApi.list).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        search: "beras",
      });
    });

    vi.useRealTimers();
  });

  it("deletes a supplier after confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(suppliersAdminApi.delete).mockResolvedValue({
      data: undefined,
    });

    render(<AdminSuppliersPage />);
    await screen.findByText("Beras Supplier");

    await user.click(screen.getByLabelText("Delete supplier"));
    expect(screen.getByText("Delete supplier")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(suppliersAdminApi.delete).toHaveBeenCalledWith("sup-1");
    });
  });

  it("creates a supplier from the dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(suppliersAdminApi.create).mockResolvedValue({
      data: {
        ...supplier,
        id: "sup-2",
        name: "New Supplier",
      },
    });

    render(<AdminSuppliersPage />);
    await screen.findByText("Beras Supplier");

    await user.click(
      screen.getAllByRole("button", { name: "Add supplier" })[0],
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Name"), "New Supplier");
    await user.type(
      within(dialog).getByLabelText("Phone number"),
      "08111111111",
    );
    await user.type(
      within(dialog).getByLabelText("Address"),
      "Jl. Baru 1",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Add supplier" }),
    );

    await waitFor(() => {
      expect(suppliersAdminApi.create).toHaveBeenCalledWith({
        name: "New Supplier",
        phone_number: "08111111111",
        address: "Jl. Baru 1",
        supports_delivery: false,
        delivery_cost: 0,
        food_items: [],
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Supplier created");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("edits a supplier from the dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(suppliersAdminApi.update).mockResolvedValue({
      data: {
        ...supplier,
        phone_number: "08999999999",
      },
    });

    render(<AdminSuppliersPage />);
    await screen.findByText("Beras Supplier");

    await user.click(screen.getByLabelText("Edit supplier"));
    expect(screen.getByText("Edit supplier")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone number")).toHaveValue("08123456789");

    await user.clear(screen.getByLabelText("Phone number"));
    await user.type(screen.getByLabelText("Phone number"), "08999999999");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(suppliersAdminApi.update).toHaveBeenCalledWith("sup-1", {
        name: "Beras Supplier",
        phone_number: "08999999999",
        address: "Jl. Pasar 12",
        supports_delivery: true,
        delivery_cost: 15000,
        food_items: [
          {
            food_supply_id: "fs-1",
            price: 84000,
            quantity: 5000,
            unit: "gr",
          },
          {
            food_supply_id: "fs-2",
            price: 25000,
            quantity: 1000,
            unit: "ml",
          },
        ],
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Supplier updated");
  });

  it("maps server validation errors onto form fields", async () => {
    const user = userEvent.setup();
    vi.mocked(suppliersAdminApi.create).mockRejectedValue(
      new ApiError(422, "validation_error", "Validation failed", {
        phone_number: "Phone number is invalid",
      }),
    );

    render(<AdminSuppliersPage />);
    await screen.findByText("Beras Supplier");

    await user.click(
      screen.getAllByRole("button", { name: "Add supplier" })[0],
    );
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByLabelText("Name"), "New Supplier");
    await user.type(
      within(dialog).getByLabelText("Phone number"),
      "08111111111",
    );
    await user.type(
      within(dialog).getByLabelText("Address"),
      "Jl. Baru 1",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Add supplier" }),
    );

    expect(
      await screen.findByText("Phone number is invalid"),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the dialog on cancel without saving", async () => {
    const user = userEvent.setup();

    render(<AdminSuppliersPage />);
    await screen.findByText("Beras Supplier");

    await user.click(
      screen.getAllByRole("button", { name: "Add supplier" })[0],
    );
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), "Temp Supplier");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(suppliersAdminApi.create).not.toHaveBeenCalled();
  });
});
