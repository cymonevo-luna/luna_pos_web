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
  total_estimated_amount: 280000,
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

  it("shows em dash when created_by_username is null", async () => {
    vi.mocked(purchaseRequestsAdminApi.list).mockResolvedValue({
      data: [{ ...purchase, created_by_username: null }],
      meta: { page: 1, per_page: 10, total: 1 },
    });

    render(<AdminPurchasesPage />);

    expect(await screen.findByText("Beras Supplier")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
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

  it("shows formatted total estimation from total_estimated_amount", async () => {
    render(<AdminPurchasesPage />);

    expect(await screen.findByText("Rp 280.000")).toBeInTheDocument();
    expect(screen.queryByText("Rp 0")).not.toBeInTheDocument();
  });

  it("renders Rp 0 when total_estimated_amount is zero", async () => {
    vi.mocked(purchaseRequestsAdminApi.list).mockResolvedValue({
      data: [{ ...purchase, total_estimated_amount: 0 }],
      meta: { page: 1, per_page: 10, total: 1 },
    });

    render(<AdminPurchasesPage />);

    expect(await screen.findByText("Rp 0")).toBeInTheDocument();
  });

  it("renders multiple rows with different total estimations", async () => {
    const secondPurchase: PurchaseRequestSummary = {
      ...purchase,
      id: "pr-2",
      supplier_name: "Sayur Supplier",
      total_estimated_amount: 40000,
    };

    vi.mocked(purchaseRequestsAdminApi.list).mockResolvedValue({
      data: [
        { ...purchase, total_estimated_amount: 118000 },
        secondPurchase,
      ],
      meta: { page: 1, per_page: 10, total: 2 },
    });

    render(<AdminPurchasesPage />);

    expect(await screen.findByText("Rp 118.000")).toBeInTheDocument();
    expect(screen.getByText("Rp 40.000")).toBeInTheDocument();
  });

  it("refetches list on remount so deleted purchase is not shown", async () => {
    const { unmount } = render(<AdminPurchasesPage />);

    expect(await screen.findByText("Beras Supplier")).toBeInTheDocument();
    expect(purchaseRequestsAdminApi.list).toHaveBeenCalledTimes(1);

    unmount();

    vi.mocked(purchaseRequestsAdminApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 10, total: 0 },
    });

    render(<AdminPurchasesPage />);

    await waitFor(() => {
      expect(purchaseRequestsAdminApi.list).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText("Beras Supplier")).not.toBeInTheDocument();
    expect(screen.getByText("0 total")).toBeInTheDocument();
  });
});
