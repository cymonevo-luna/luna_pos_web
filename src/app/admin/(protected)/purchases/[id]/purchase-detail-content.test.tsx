import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminPurchaseDetailContent } from "./purchase-detail-content";
import { purchaseRequestsAdminApi } from "@/lib/api/purchase-requests";
import type { PurchaseRequest } from "@/lib/api/types";
import { toast } from "sonner";

vi.mock("@/lib/api/purchase-requests", () => ({
  purchaseRequestsAdminApi: {
    get: vi.fn(),
    updateStatus: vi.fn(),
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
  notes: null,
  created_by: "admin",
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
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("AdminPurchaseDetailContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(purchaseRequestsAdminApi.get).mockResolvedValue({ data: purchase });
  });

  it("renders purchase detail with line items and total", async () => {
    render(<AdminPurchaseDetailContent id="pr-1" />);

    expect(await screen.findByText("Beras Supplier")).toBeInTheDocument();
    expect(screen.getByText("Beras")).toBeInTheDocument();
    expect(screen.getByText("2 gr")).toBeInTheDocument();
    expect(screen.getAllByText("Rp 280").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  it("updates status via the API and shows a success toast", async () => {
    const user = userEvent.setup();
    const updatedPurchase = { ...purchase, status: "REQUESTED" as const };
    vi.mocked(purchaseRequestsAdminApi.updateStatus).mockResolvedValue({
      data: updatedPurchase,
    });

    render(<AdminPurchaseDetailContent id="pr-1" />);
    await screen.findByText("Beras Supplier");

    await user.selectOptions(
      screen.getByLabelText("Purchase request status"),
      "REQUESTED",
    );

    await waitFor(() => {
      expect(purchaseRequestsAdminApi.updateStatus).toHaveBeenCalledWith(
        "pr-1",
        "REQUESTED",
      );
    });
    expect(toast.success).toHaveBeenCalledWith("Status updated");
    expect(screen.getByText("REQUESTED")).toBeInTheDocument();
  });

  it("disables contact supplier when contact info has no phone", async () => {
    vi.mocked(purchaseRequestsAdminApi.get).mockResolvedValue({
      data: {
        ...purchase,
        supplier_contact_info: "supplier@example.com",
      },
    });

    render(<AdminPurchaseDetailContent id="pr-1" />);
    await screen.findByText("Beras Supplier");

    const button = screen.getByRole("button", { name: "Contact supplier" });
    expect(button).toBeDisabled();
    expect(button.closest("span")).toHaveAttribute(
      "title",
      "No WhatsApp number in contact info",
    );
  });

  it("shows an error card when the purchase request cannot be loaded", async () => {
    vi.mocked(purchaseRequestsAdminApi.get).mockRejectedValue(
      new Error("Purchase request not found"),
    );

    render(<AdminPurchaseDetailContent id="nonexistent-id" />);

    expect(
      await screen.findByText("Failed to load purchase request"),
    ).toBeInTheDocument();
  });
});
