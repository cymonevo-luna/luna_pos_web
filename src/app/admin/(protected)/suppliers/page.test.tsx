import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminSuppliersPage from "./page";
import { suppliersAdminApi } from "@/lib/api/suppliers";
import type { Supplier } from "@/lib/api/types";

vi.mock("@/lib/api/suppliers", () => ({
  suppliersAdminApi: {
    list: vi.fn(),
    delete: vi.fn(),
  },
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
  supports_delivery: true,
  delivery_cost: 15000,
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
    {
      id: "price-2",
      food_supply_id: "fs-2",
      food_supply_title: "Cooking oil",
      price_amount: 25000,
      price_quantity: 1000,
      unit: "ml",
      unit_price: 25,
    },
  ],
  price_quotes_count: 2,
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
  });

  it("renders suppliers from the API", async () => {
    render(<AdminSuppliersPage />);

    expect(await screen.findByText("Beras Supplier")).toBeInTheDocument();
    expect(screen.getByText("08123456789")).toBeInTheDocument();
    expect(screen.getByText("Jl. Pasar 12")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1 total")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
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

  it("links to new supplier, detail, and edit pages", async () => {
    render(<AdminSuppliersPage />);
    await screen.findByText("Beras Supplier");

    expect(screen.getByRole("link", { name: "New supplier" })).toHaveAttribute(
      "href",
      "/admin/suppliers/new",
    );
    expect(screen.getByLabelText("View supplier")).toHaveAttribute(
      "href",
      "/admin/suppliers/sup-1",
    );
    expect(screen.getByLabelText("Edit supplier")).toHaveAttribute(
      "href",
      "/admin/suppliers/sup-1/edit",
    );
  });
});
