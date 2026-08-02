import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { createTestQueryClient, TestQueryProvider } from "@/test/query-provider";
import AdminTransactionsPage from "./page";
import { transactionsAdminApi } from "@/lib/api/transactions";
import { ApiError } from "@/lib/api/client";
import type { Transaction, TransactionSummary } from "@/lib/api/types";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query/keys";
import { invalidateTransactionQueries } from "@/lib/query/invalidate-transaction-queries";
import * as wib from "@/lib/datetime/wib";

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

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({
      children,
    }: {
      children: React.ReactElement<{ width?: number; height?: number }>;
    }) => React.cloneElement(children, { width: 800, height: 300 }),
  };
});

const todaySummary: TransactionSummary = {
  period: "daily",
  buckets: [
    {
      period_start: "2026-07-25T00:00:00+07:00",
      period_label: "Jul 25",
      count: 5,
      total_amount: 100_000,
    },
  ],
};

const weekSummary: TransactionSummary = {
  period: "daily",
  buckets: [
    {
      period_start: "2026-07-20T00:00:00+07:00",
      period_label: "Jul 20",
      count: 10,
      total_amount: 250_000,
    },
    {
      period_start: "2026-07-25T00:00:00+07:00",
      period_label: "Jul 25",
      count: 10,
      total_amount: 250_000,
    },
  ],
};

const monthSummary: TransactionSummary = {
  period: "daily",
  buckets: [
    {
      period_start: "2026-07-01T00:00:00+07:00",
      period_label: "Jul 1",
      count: 40,
      total_amount: 1_000_000,
    },
    {
      period_start: "2026-07-25T00:00:00+07:00",
      period_label: "Jul 25",
      count: 40,
      total_amount: 1_000_000,
    },
  ],
};

const trendChartSummary: TransactionSummary = {
  period: "daily",
  buckets: [
    {
      period_start: "2026-01-01T00:00:00Z",
      period_label: "Jan 1",
      count: 3,
      total_amount: 150_000,
    },
    {
      period_start: "2026-01-02T00:00:00Z",
      period_label: "Jan 2",
      count: 5,
      total_amount: 250_000,
    },
  ],
};

function mockPeriodSummaries() {
  vi.mocked(transactionsAdminApi.summary).mockImplementation(
    async (params) => {
      if (params.period !== "daily") {
        return { data: trendChartSummary };
      }
      if (params.dateFrom === params.dateTo) {
        return { data: todaySummary };
      }
      if (params.dateFrom?.endsWith("-01")) {
        return { data: monthSummary };
      }
      return { data: weekSummary };
    },
  );
}

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
    vi.spyOn(wib, "todayWIB").mockReturnValue("2026-07-25");
    vi.mocked(transactionsAdminApi.list).mockResolvedValue({
      data: [transaction1, transaction2],
      meta: { page: 1, per_page: 10, total: 2 },
    });
    mockPeriodSummaries();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders summary stats and trend chart above the transactions table", async () => {
    renderWithProviders(<AdminTransactionsPage />);

    expect(await screen.findByText("Today")).toBeInTheDocument();
    expect(screen.getByText("This week")).toBeInTheDocument();
    expect(screen.getByText("This month")).toBeInTheDocument();

    const chart =
      (await screen.findByTestId("transaction-trend-chart")) ??
      screen.getByTestId("trend-chart-loading");
    expect(chart).toBeInTheDocument();

    const table = screen.getByRole("table");
    expect(
      chart.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders transactions from the API with Rupiah amounts and cashier names", async () => {
    renderWithProviders(<AdminTransactionsPage />);

    expect(await screen.findByText("Rp 50.000")).toBeInTheDocument();
    expect(screen.getByText("Rp 30.000")).toBeInTheDocument();
    expect(screen.getByText("kasir1")).toBeInTheDocument();
    expect(screen.getByText("kasir2")).toBeInTheDocument();
    expect(screen.getByText("2 total")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Transactions" })).toBeInTheDocument();
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

  it("reloads with Today preset using WIB calendar day", async () => {
    const user = userEvent.setup();

    renderWithProviders(<AdminTransactionsPage />);
    await screen.findByText("kasir1");

    await user.selectOptions(
      screen.getByTestId("transactions-date-preset"),
      "today",
    );

    await waitFor(() => {
      expect(transactionsAdminApi.list).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        method: "",
        dateFrom: "2026-07-25",
        dateTo: "2026-07-25",
      });
    });
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

  it("refetches list and summary after transaction delete invalidation", async () => {
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

    const summaryCallsBeforeInvalidation =
      vi.mocked(transactionsAdminApi.summary).mock.calls.length;
    expect(summaryCallsBeforeInvalidation).toBeGreaterThan(0);

    await invalidateTransactionQueries(queryClient);

    await waitFor(() => {
      expect(transactionsAdminApi.list).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(
        vi.mocked(transactionsAdminApi.summary).mock.calls.length,
      ).toBeGreaterThan(summaryCallsBeforeInvalidation);
    });

    await waitFor(() => {
      expect(screen.queryByText("kasir1")).not.toBeInTheDocument();
      expect(screen.getByText("kasir2")).toBeInTheDocument();
      expect(screen.getByText("1 total")).toBeInTheDocument();
    });
  });
});
