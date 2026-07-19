import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { createTestQueryClient, TestQueryProvider } from "@/test/query-provider";
import userEvent from "@testing-library/user-event";
import AdminTransactionsPage from "./page";
import { transactionsAdminApi } from "@/lib/api/transactions";
import { ApiError } from "@/lib/api/client";
import type { Transaction } from "@/lib/api/types";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query/keys";
import { invalidateTransactionQueries } from "@/lib/query/invalidate-transaction-queries";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/api/transactions", () => ({
  transactionsAdminApi: {
    list: vi.fn(),
    get: vi.fn(),
    summary: vi.fn(),
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

const transaction2: Transaction = {
  id: "txn-bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
  method: "CASH",
  amount: 30000,
  cash_tendered: 50000,
  change_amount: 20000,
  cashier_user_id: "user-2",
  cashier_username: "kasir2",
  items: [
    {
      menu_id: "menu-2",
      title: "Mie Goreng",
      quantity: 1,
      unit_price: 30000,
      line_total: 30000,
    },
  ],
  transaction_date: "2026-01-16T11:00:00Z",
  created_at: "2026-01-16T11:00:00Z",
};

describe("AdminTransactionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(transactionsAdminApi.list).mockResolvedValue({
      data: [transaction1, transaction2],
      meta: { page: 1, per_page: 10, total: 2 },
    });
    vi.mocked(transactionsAdminApi.summary).mockResolvedValue({
      data: { period: "daily", buckets: [] },
    });
  });

  it("renders transactions from the API with Rupiah amounts and cashier names", async () => {
    renderWithProviders(<AdminTransactionsPage />);

    expect(await screen.findByText("Rp 50.000")).toBeInTheDocument();
    expect(screen.getByText("Rp 30.000")).toBeInTheDocument();
    expect(screen.getByText("kasir1")).toBeInTheDocument();
    expect(screen.getByText("kasir2")).toBeInTheDocument();
    expect(screen.getByText("2 total")).toBeInTheDocument();
    expect(screen.getByText("Transactions")).toBeInTheDocument();
  });

  it("shows empty state when no transactions match", async () => {
    vi.mocked(transactionsAdminApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 10, total: 0 },
    });

    renderWithProviders(<AdminTransactionsPage />);

    expect(
      await screen.findByText("No transactions found."),
    ).toBeInTheDocument();
  });

  it("reloads with date and method filters", async () => {
    const user = userEvent.setup();

    renderWithProviders(<AdminTransactionsPage />);
    await screen.findByText("kasir1");

    await user.selectOptions(
      screen.getByLabelText("Filter by method"),
      "CASH",
    );

    await waitFor(() => {
      expect(transactionsAdminApi.list).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        method: "CASH",
        dateFrom: "",
        dateTo: "",
      });
    });
  });

  it("navigates to detail on row click", async () => {
    const user = userEvent.setup();

    renderWithProviders(<AdminTransactionsPage />);
    await screen.findByText("kasir1");

    await user.click(screen.getByText("kasir1"));

    expect(mockPush).toHaveBeenCalledWith(
      `/admin/transactions/${transaction1.id}`,
    );
  });

  it("shows error toast when loading fails", async () => {
    vi.mocked(transactionsAdminApi.list).mockRejectedValue(
      new ApiError(500, "server_error", "Server error"),
    );

    renderWithProviders(<AdminTransactionsPage />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Server error");
    });
  });

  it("refetches list after transaction delete invalidation", async () => {
    const listParams = {
      page: 1,
      perPage: 10,
      method: "" as const,
      dateFrom: "",
      dateTo: "",
    };

    vi.mocked(transactionsAdminApi.list)
      .mockResolvedValueOnce({
        data: [transaction1, transaction2],
        meta: { page: 1, per_page: 10, total: 2 },
      })
      .mockResolvedValueOnce({
        data: [transaction2],
        meta: { page: 1, per_page: 10, total: 1 },
      });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.transactions.list(listParams), {
      data: [transaction1, transaction2],
      meta: { page: 1, per_page: 10, total: 2 },
    });

    render(
      <TestQueryProvider client={queryClient}>
        <AdminTransactionsPage />
      </TestQueryProvider>,
    );

    expect(await screen.findByText("kasir1")).toBeInTheDocument();
    expect(screen.getByText("kasir2")).toBeInTheDocument();
    expect(screen.getByText("2 total")).toBeInTheDocument();
    expect(transactionsAdminApi.list).toHaveBeenCalledTimes(1);

    await invalidateTransactionQueries(queryClient);

    await waitFor(() => {
      expect(transactionsAdminApi.list).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.queryByText("kasir1")).not.toBeInTheDocument();
      expect(screen.getByText("kasir2")).toBeInTheDocument();
      expect(screen.getByText("1 total")).toBeInTheDocument();
    });
  });
});
