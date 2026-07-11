import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminFoodSuppliesPage from "./page";
import { foodSuppliesAdminApi } from "@/lib/api/food-supplies";
import type { FoodSupply } from "@/lib/api/types";

vi.mock("@/lib/api/food-supplies", () => ({
  foodSuppliesAdminApi: {
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

const supply: FoodSupply = {
  id: "fs-1",
  title: "Olive oil",
  description: "Extra virgin",
  stock_quantity: 500,
  unit: "ml",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

describe("AdminFoodSuppliesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(foodSuppliesAdminApi.list).mockResolvedValue({
      data: [supply],
      meta: { page: 1, per_page: 10, total: 1 },
    });
  });

  it("renders supplies from the API", async () => {
    render(<AdminFoodSuppliesPage />);

    expect(await screen.findByText("Olive oil")).toBeInTheDocument();
    expect(screen.getByText("Extra virgin")).toBeInTheDocument();
    expect(screen.getByText("500 ml")).toBeInTheDocument();
    expect(screen.getByText("1 total")).toBeInTheDocument();
  });

  it("shows empty state when no supplies match", async () => {
    vi.mocked(foodSuppliesAdminApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 10, total: 0 },
    });

    render(<AdminFoodSuppliesPage />);

    expect(
      await screen.findByText("No food supplies found."),
    ).toBeInTheDocument();
  });

  it("debounces search and reloads with the search term", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<AdminFoodSuppliesPage />);
    await screen.findByText("Olive oil");

    await user.type(screen.getByPlaceholderText("Search by title"), "oil");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(foodSuppliesAdminApi.list).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        search: "oil",
      });
    });

    vi.useRealTimers();
  });

  it("deletes a supply after confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(foodSuppliesAdminApi.delete).mockResolvedValue({
      data: undefined,
    });

    render(<AdminFoodSuppliesPage />);
    await screen.findByText("Olive oil");

    await user.click(screen.getByLabelText("Delete food supply"));
    expect(screen.getByText("Delete food supply")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(foodSuppliesAdminApi.delete).toHaveBeenCalledWith("fs-1");
    });
  });
});
