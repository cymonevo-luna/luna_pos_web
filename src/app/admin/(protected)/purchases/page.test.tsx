import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminPurchasesPage from "./page";
import { purchaseRequestsAdminApi } from "@/lib/api/purchase-requests";
import { ApiError } from "@/lib/api/client";
import type { PurchaseRequestSummary } from "@/lib/api/types";
import { toast } from "sonner";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/api/purchase-requests", () => ({
  purchaseRequestsAdminApi: {
    list: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const purchase: PurchaseRequestSummary = {
  id: "pr-1",
  supplier_id: "sup-1",
  supplier_name: "Beras Supplier",
  status: "PENDING",
  item_count: 2,
  total_amount: 280000,
  created_by_username: "admin1",
  created_at: "2026-01-15T10:30:00Z",
  updated_at: "2026-01-15T10:30:00Z",
};

describe("AdminPurchasesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(purchaseRequestsAdminApi.list).mockResolvedValue({
      data: [purchase],
      meta: { page: 1, per_page: 10, total: 1 },
    });
  });

  it("renders table headers and purchase rows from the API", async () => {
    render(<AdminPurchasesPage />);

    expect(await screen.findByText("Beras Supplier")).toBeInTheDocument();
    expect(screen.getByText("Rp 280.000")).toBeInTheDocument();
    expect(screen.getByText("admin1")).toBeInTheDocument();
    expect(screen.getByText("1 total")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Created" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Supplier" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Status" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Items" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Total estimate" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Created by" }),
    ).toBeInTheDocument();
  });

  it("links to the new purchase request page", async () => {
    render(<AdminPurchasesPage />);
    await screen.findByText("Beras Supplier");

    expect(
      screen.getByRole("link", { name: "New purchase request" }),
    ).toHaveAttribute("href", "/admin/purchases/new");
  });

  it("shows empty state when no purchase requests match", async () => {
    vi.mocked(purchaseRequestsAdminApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 10, total: 0 },
    });

    render(<AdminPurchasesPage />);

    expect(
      await screen.findByText("No purchase requests found."),
    ).toBeInTheDocument();
  });

  it("reloads with status filter", async () => {
    const user = userEvent.setup();

    render(<AdminPurchasesPage />);
    await screen.findByText("Beras Supplier");

    await user.selectOptions(
      screen.getByLabelText("Filter by status"),
      "PENDING",
    );

    await waitFor(() => {
      expect(purchaseRequestsAdminApi.list).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        status: "PENDING",
      });
    });
  });

  it("navigates to detail on row click", async () => {
    const user = userEvent.setup();

    render(<AdminPurchasesPage />);
    await screen.findByText("Beras Supplier");

    await user.click(screen.getByText("Beras Supplier"));

    expect(mockPush).toHaveBeenCalledWith("/admin/purchases/pr-1");
  });

  it("shows error toast when loading fails", async () => {
    vi.mocked(purchaseRequestsAdminApi.list).mockRejectedValue(
      new ApiError(500, "server_error", "Server error"),
    );

    render(<AdminPurchasesPage />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Server error");
    });
  });
});
