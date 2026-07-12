import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ProductionRequestDetailContent } from "./production-request-detail-content";
import { productionRequestsAdminApi } from "@/lib/api/production-requests";
import { ApiError } from "@/lib/api/client";
import type { ProductionRequest } from "@/lib/api/types";
import { toast } from "sonner";

vi.mock("@/lib/api/production-requests", () => ({
  productionRequestsAdminApi: {
    get: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const productionRequest: ProductionRequest = {
  id: "pr-qa-1",
  status: "REQUESTED",
  is_fully_producible: true,
  created_by_username: "manager-test",
  notes: "Rush order for weekend",
  created_at: "2026-01-01T08:00:00Z",
  updated_at: "2026-01-01T08:00:00Z",
  items: [
    {
      id: "item-1",
      menu_id: "menu-a",
      menu_title: "Nasi Goreng",
      quantity: 5,
      is_finished: false,
      stock_estimation: {
        has_formula: true,
        is_fully_producible: true,
        limiting_ingredient_title: null,
        ingredients: [
          {
            food_supply_id: "fs-1",
            food_supply_title: "Rice",
            unit: "gr",
            quantity_per_unit: 200,
            required_quantity: 1000,
            current_stock_quantity: 5000,
            remaining_after: 4000,
            is_sufficient: true,
          },
        ],
      },
    },
  ],
  aggregated_ingredients: [
    {
      food_supply_id: "fs-1",
      food_supply_title: "Rice",
      unit: "gr",
      required_quantity: 1000,
      current_stock_quantity: 5000,
      remaining_after: 4000,
      is_sufficient: true,
    },
  ],
  status_history: [
    {
      id: "hist-1",
      from_status: null,
      to_status: "REQUESTED",
      changed_by_username: "manager-test",
      created_at: "2026-01-01T08:00:00Z",
    },
  ],
};

describe("ProductionRequestDetailContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(productionRequestsAdminApi.get).mockResolvedValue({
      data: productionRequest,
    });
  });

  it("renders REQUESTED status badge and line items with stock indicators", async () => {
    render(<ProductionRequestDetailContent id="pr-qa-1" />);

    expect(await screen.findByText("Production request")).toBeInTheDocument();

    const statusBadge = screen.getByTestId("production-request-status-badge");
    expect(statusBadge).toHaveTextContent("REQUESTED");

    expect(screen.getByText("Nasi Goreng")).toBeInTheDocument();
    expect(screen.getByText("Qty:")).toBeInTheDocument();
    expect(
      screen.getByTestId("production-estimation-status-badge-menu-a"),
    ).toHaveTextContent("Sufficient stock");

    expect(
      screen.getByTestId("production-request-producibility-badge"),
    ).toHaveTextContent("Fully producible");
  });

  it("renders aggregated ingredients table", async () => {
    render(<ProductionRequestDetailContent id="pr-qa-1" />);

    expect(
      await screen.findByRole("heading", { name: "Aggregated ingredients" }),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("production-estimation-aggregated-ingredients"),
    ).toBeInTheDocument();
    const table = screen.getByTestId("production-estimation-aggregated-ingredients");
    expect(within(table).getByText("Rice")).toBeInTheDocument();
    expect(within(table).getByText("1 kg")).toBeInTheDocument();
  });

  it("renders status history oldest first", async () => {
    vi.mocked(productionRequestsAdminApi.get).mockResolvedValue({
      data: {
        ...productionRequest,
        status_history: [
          {
            id: "hist-2",
            from_status: "REQUESTED",
            to_status: "ACCEPTED",
            changed_by_username: "operational",
            created_at: "2026-01-02T09:00:00Z",
          },
          {
            id: "hist-1",
            from_status: null,
            to_status: "REQUESTED",
            changed_by_username: "manager-test",
            created_at: "2026-01-01T08:00:00Z",
          },
        ],
      },
    });

    render(<ProductionRequestDetailContent id="pr-qa-1" />);

    const historyHeading = await screen.findByRole("heading", {
      name: "Status history",
    });
    const historySection = historyHeading.closest(".rounded-2xl") as HTMLElement;
    const entries = within(historySection).getAllByText(/REQUESTED/);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(within(historySection).getByText("REQUESTED → ACCEPTED")).toBeInTheDocument();
    expect(within(historySection).getByText("manager-test")).toBeInTheDocument();
    expect(within(historySection).getByText("operational")).toBeInTheDocument();
  });

  it("links back to production requests list", async () => {
    render(<ProductionRequestDetailContent id="pr-qa-1" />);

    const backLink = await screen.findByRole("link", {
      name: /Back to production requests/i,
    });
    expect(backLink).toHaveAttribute("href", "/admin/production-requests");
  });

  it("shows toast on API error", async () => {
    vi.mocked(productionRequestsAdminApi.get).mockRejectedValue(
      new ApiError(404, "not_found", "Production request not found"),
    );

    render(<ProductionRequestDetailContent id="missing-id" />);

    expect(
      await screen.findByText("Production request not found"),
    ).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Production request not found");
  });
});
