import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminTransactionDetailContent } from "./transaction-detail-content";
import { transactionsAdminApi } from "@/lib/api/transactions";
import { ApiError } from "@/lib/api/client";
import { useRoles } from "@/lib/auth/use-roles";
import type { Transaction } from "@/lib/api/types";
import { toast } from "sonner";
import { TestQueryProvider } from "@/test/query-provider";
import { invalidateTransactionQueries } from "@/lib/query/invalidate-transaction-queries";
import { invalidateCashierBalanceData } from "@/lib/hooks/use-cashier-balance";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/auth/use-roles", () => ({
  useRoles: vi.fn(),
}));

vi.mock("@/lib/api/transactions", () => ({
  transactionsAdminApi: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/query/invalidate-transaction-queries", () => ({
  invalidateTransactionQueries: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/hooks/use-cashier-balance", () => ({
  invalidateCashierBalanceData: vi.fn(),
}));

const transaction: Transaction = {
  id: "txn-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  method: "CASH",
  amount: 50000,
  cash_tendered: 100000,
  change_amount: 50000,
  cashier_user_id: "user-1",
  cashier_username: "kasir1",
  items: [
    {
      menu_id: "menu-1",
      title: "Nasi Goreng",
      quantity: 2,
      unit_price: 25000,
      line_total: 50000,
    },
  ],
  transaction_date: "2026-01-15T10:30:00Z",
  created_at: "2026-01-15T10:30:00Z",
};

function mockAdminRoles() {
  vi.mocked(useRoles).mockReturnValue({
    roles: ["admin"],
    hasRole: (role) => role === "admin",
    hasAnyRole: (roles) => roles.includes("admin"),
  });
}

function mockManagerRoles() {
  vi.mocked(useRoles).mockReturnValue({
    roles: ["manager"],
    hasRole: (role) => role === "manager",
    hasAnyRole: (roles) => roles.includes("manager"),
  });
}

function renderDetail(id: string = transaction.id) {
  return render(
    <TestQueryProvider>
      <AdminTransactionDetailContent id={id} />
    </TestQueryProvider>,
  );
}

describe("AdminTransactionDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminRoles();
    vi.mocked(transactionsAdminApi.get).mockResolvedValue({ data: transaction });
  });

  it("shows Delete transaction button for admin users", async () => {
    renderDetail();

    expect(
      await screen.findByRole("button", { name: "Delete transaction" }),
    ).toBeInTheDocument();
  });

  it("does not show Delete transaction button for manager users", async () => {
    mockManagerRoles();

    renderDetail();

    await screen.findByText("kasir1");

    expect(
      screen.queryByRole("button", { name: "Delete transaction" }),
    ).not.toBeInTheDocument();
  });

  it("invalidates queries before navigating after confirmed delete", async () => {
    const user = userEvent.setup();
    const callOrder: string[] = [];

    vi.mocked(transactionsAdminApi.delete).mockImplementation(async () => {
      callOrder.push("delete");
      return { data: undefined };
    });
    vi.mocked(invalidateTransactionQueries).mockImplementation(async () => {
      callOrder.push("invalidateTransactions");
    });
    vi.mocked(invalidateCashierBalanceData).mockImplementation(() => {
      callOrder.push("invalidateCashierBalance");
    });
    vi.mocked(toast.success).mockImplementation(() => {
      callOrder.push("toast");
      return "toast-id";
    });
    vi.mocked(mockPush).mockImplementation(() => {
      callOrder.push("navigate");
    });

    renderDetail();
    await screen.findByRole("button", { name: "Delete transaction" });

    await user.click(screen.getByRole("button", { name: "Delete transaction" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(transactionsAdminApi.delete).toHaveBeenCalledWith(transaction.id);
      expect(invalidateTransactionQueries).toHaveBeenCalled();
      expect(invalidateCashierBalanceData).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Transaction deleted");
      expect(mockPush).toHaveBeenCalledWith("/admin/transactions");
    });

    expect(callOrder).toEqual([
      "delete",
      "invalidateTransactions",
      "invalidateCashierBalance",
      "toast",
      "navigate",
    ]);
  });

  it("shows error toast and stays on page when delete returns 403", async () => {
    const user = userEvent.setup();
    vi.mocked(transactionsAdminApi.delete).mockRejectedValue(
      new ApiError(403, "forbidden", "Forbidden"),
    );

    renderDetail();
    await screen.findByRole("button", { name: "Delete transaction" });

    await user.click(screen.getByRole("button", { name: "Delete transaction" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Forbidden");
    });
    expect(invalidateTransactionQueries).not.toHaveBeenCalled();
    expect(invalidateCashierBalanceData).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByText("kasir1")).toBeInTheDocument();
  });
});
