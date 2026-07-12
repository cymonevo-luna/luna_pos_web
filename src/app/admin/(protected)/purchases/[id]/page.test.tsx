import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminPurchaseDetailContent } from "./purchase-detail-content";
import { purchaseRequestsAdminApi } from "@/lib/api/purchase-requests";
import { ApiError } from "@/lib/api/client";
import type { PurchaseRequest } from "@/lib/api/types";
import { toast } from "sonner";

vi.mock("@/lib/api/purchase-requests", () => ({
  purchaseRequestsAdminApi: {
    get: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const purchase: PurchaseRequest = {
  id: "pr-1",
  supplier_id: "sup-1",
  supplier_name: "Beras Supplier",
  supplier_contact_info: "08123456789",
  status: "PENDING",
  notes: "Urgent restock",
  items: [
    {
      id: "item-1",
      food_supply_id: "fs-1",
      food_supply_title: "Beras",
      unit: "gr",
      quantity: 2,
      price_quantity: 1000,
      unit_price: 140,
      price_amount: 280,
    },
  ],
  total_amount: 280,
  created_at: "2026-01-15T10:30:00Z",
  updated_at: "2026-01-15T10:30:00Z",
};

describe("AdminPurchaseDetailContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(purchaseRequestsAdminApi.get).mockResolvedValue({
      data: purchase,
    });
  });

  it("loads and displays purchase request details", async () => {
    render(<AdminPurchaseDetailContent id="pr-1" />);

    expect(await screen.findByText("Beras Supplier")).toBeInTheDocument();
    expect(screen.getByText("pr-1")).toBeInTheDocument();
    expect(screen.getByText("08123456789")).toBeInTheDocument();
    expect(screen.getByText("PENDING")).toBeInTheDocument();
    expect(screen.getAllByText("Rp 280").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Beras")).toBeInTheDocument();
    expect(screen.getByText("Urgent restock")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to purchases" }),
    ).toHaveAttribute("href", "/admin/purchases");
    expect(purchaseRequestsAdminApi.get).toHaveBeenCalledWith("pr-1");
  });

  it("shows error state when loading fails", async () => {
    vi.mocked(purchaseRequestsAdminApi.get).mockRejectedValue(
      new ApiError(404, "not_found", "Purchase request not found"),
    );

    render(<AdminPurchaseDetailContent id="pr-1" />);

    expect(
      await screen.findByText("Purchase request not found"),
    ).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Purchase request not found");
  });
});
