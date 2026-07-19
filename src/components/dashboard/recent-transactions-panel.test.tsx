import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { RecentTransactionsPanel } from "./recent-transactions-panel";
import { transactionsAdminApi } from "@/lib/api/transactions";
import { useRoles } from "@/lib/auth/use-roles";
import { formatDateTime } from "@/lib/utils";
import type { Transaction } from "@/lib/api/types";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";

vi.mock("@/lib/auth/use-roles", () => ({
  useRoles: vi.fn(),
}));

vi.mock("@/lib/api/transactions", () => ({
  transactionsAdminApi: {
    list: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const transaction1: Transaction = {
  id: "txn-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  method: "CASH",
  amount: 50000,
  cash_tendered: 100000,
  change_amount: 50000,
  cashier_user_id: "user-1",
  cashier_username: "kasir1",
  items: [],
  transaction_date: "2026-01-15T10:30:00Z",
  created_at: "2026-01-15T10:30:00Z",
};

const transaction2: Transaction = {
  id: "txn-bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
  method: "CASH",
  amount: 30000,
  cash_tendered: 50000,
  change_amount: 20000,
  cashier_user_id: "user-2",
  cashier_username: "kasir2",
  items: [],
  transaction_date: "2026-01-16T11:00:00Z",
  created_at: "2026-01-16T11:00:00Z",
};

function mockManagerRoles() {
  vi.mocked(useRoles).mockReturnValue({
    roles: ["manager"],
    hasRole: (role) => role === "manager",
    hasAnyRole: (roles) => roles.includes("manager"),
  });
}

function mockOperationalRoles() {
  vi.mocked(useRoles).mockReturnValue({
    roles: ["operational"],
    hasRole: () => false,
    hasAnyRole: (roles) => roles.includes("operational"),
  });
}

describe("RecentTransactionsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockManagerRoles();
    vi.mocked(transactionsAdminApi.list).mockResolvedValue({
      data: [transaction1, transaction2],
      meta: { page: 1, per_page: 5, total: 2 },
    });

    class MockIntersectionObserver implements IntersectionObserver {
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds = [0];

      constructor(private callback: IntersectionObserverCallback) {
        queueMicrotask(() => {
          this.callback(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            this,
          );
        });
      }

      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists latest sales with Rupiah amounts and formatted dates", async () => {
    renderWithProviders(<RecentTransactionsPanel />);

    expect(await screen.findByText("kasir1")).toBeInTheDocument();
    expect(screen.getByText("kasir2")).toBeInTheDocument();
    expect(screen.getByText("Rp 50.000")).toBeInTheDocument();
    expect(screen.getByText("Rp 30.000")).toBeInTheDocument();
    expect(
      screen.getByText(formatDateTime(transaction1.transaction_date)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(formatDateTime(transaction2.transaction_date)),
    ).toBeInTheDocument();

    expect(transactionsAdminApi.list).toHaveBeenCalledWith({
      page: 1,
      perPage: 5,
    });
  });

  it('shows "No transactions yet" when the API returns an empty list', async () => {
    vi.mocked(transactionsAdminApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 5, total: 0 },
    });

    renderWithProviders(<RecentTransactionsPanel />);

    expect(await screen.findByText("No transactions yet")).toBeInTheDocument();
  });

  it("renders nothing for non-managers and does not call the API", () => {
    mockOperationalRoles();

    const { container } = renderWithProviders(<RecentTransactionsPanel />);

    expect(container).toBeEmptyDOMElement();
    expect(transactionsAdminApi.list).not.toHaveBeenCalled();
  });

  it('links "View all" to the transactions page', async () => {
    renderWithProviders(<RecentTransactionsPanel />);

    await screen.findByText("kasir1");

    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      "/admin/transactions",
    );
  });

  it("links each row to the transaction detail route", async () => {
    renderWithProviders(<RecentTransactionsPanel />);

    await screen.findByText("kasir1");

    expect(
      screen.getByRole("link", { name: new RegExp(transaction1.cashier_username) }),
    ).toHaveAttribute("href", `/admin/transactions/${transaction1.id}`);
    expect(
      screen.getByRole("link", { name: new RegExp(transaction2.cashier_username) }),
    ).toHaveAttribute("href", `/admin/transactions/${transaction2.id}`);
  });

  it("shows an error toast and empty state when loading fails", async () => {
    vi.mocked(transactionsAdminApi.list).mockRejectedValue(
      new ApiError(500, "server_error", "Server error"),
    );

    renderWithProviders(<RecentTransactionsPanel />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Server error");
    });
    expect(await screen.findByText("No transactions yet")).toBeInTheDocument();
  });
});
