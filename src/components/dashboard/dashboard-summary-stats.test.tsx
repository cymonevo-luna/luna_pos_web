import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DashboardSummaryStats } from "./dashboard-summary-stats";
import { transactionsAdminApi } from "@/lib/api/transactions";
import { adminApi } from "@/lib/api/users";
import { suppliersAdminApi } from "@/lib/api/suppliers";
import { purchaseRequestsAdminApi } from "@/lib/api/purchase-requests";
import { formatRupiah } from "@/lib/utils";
import type { TransactionSummary } from "@/lib/api/types";

vi.mock("@/lib/api/transactions", () => ({
  transactionsAdminApi: {
    summary: vi.fn(),
  },
}));

vi.mock("@/lib/api/users", () => ({
  adminApi: {
    listUsers: vi.fn(),
  },
}));

vi.mock("@/lib/api/suppliers", () => ({
  suppliersAdminApi: {
    list: vi.fn(),
  },
}));

vi.mock("@/lib/api/purchase-requests", () => ({
  purchaseRequestsAdminApi: {
    list: vi.fn(),
  },
}));

const todaySummary: TransactionSummary = {
  period: "daily",
  buckets: [
    {
      period_start: "2026-07-12T00:00:00Z",
      period_label: "Jul 12",
      count: 7,
      total_amount: 350_000,
    },
  ],
};

const thirtyDaySummary: TransactionSummary = {
  period: "daily",
  buckets: [
    {
      period_start: "2026-06-12T00:00:00Z",
      period_label: "Jun 12",
      count: 10,
      total_amount: 500_000,
    },
    {
      period_start: "2026-06-13T00:00:00Z",
      period_label: "Jun 13",
      count: 5,
      total_amount: 250_000,
    },
  ],
};

function mockManagerSummaries() {
  vi.mocked(transactionsAdminApi.summary).mockImplementation(
    async (params) => {
      if (params.dateFrom && params.dateTo) {
        return { data: todaySummary };
      }
      return { data: thirtyDaySummary };
    },
  );
}

describe("DashboardSummaryStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders manager sales KPIs from transaction summaries", async () => {
    mockManagerSummaries();

    render(<DashboardSummaryStats roles={["manager"]} />);

    expect(await screen.findByText("Today's revenue")).toBeInTheDocument();
    expect(screen.getByText(formatRupiah(350_000))).toBeInTheDocument();
    expect(screen.getByText("Today's transactions")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Last 30 days revenue")).toBeInTheDocument();
    expect(screen.getByText(formatRupiah(750_000))).toBeInTheDocument();
  });

  it("renders admin user count from listUsers meta total", async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 1, total: 42 },
    });

    render(<DashboardSummaryStats roles={["admin"]} />);

    expect(await screen.findByText("Total users")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders operational supplier and purchase request counts", async () => {
    vi.mocked(suppliersAdminApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 1, total: 12 },
    });
    vi.mocked(purchaseRequestsAdminApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 1, total: 5 },
    });

    render(<DashboardSummaryStats roles={["operational"]} />);

    expect(await screen.findByText("Suppliers")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Purchase requests")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows loading skeletons before summary data resolves", async () => {
    let resolveToday!: (value: { data: TransactionSummary }) => void;
    let resolveThirtyDay!: (value: { data: TransactionSummary }) => void;

    const todayPromise = new Promise<{ data: TransactionSummary }>((resolve) => {
      resolveToday = resolve;
    });
    const thirtyDayPromise = new Promise<{ data: TransactionSummary }>(
      (resolve) => {
        resolveThirtyDay = resolve;
      },
    );

    vi.mocked(transactionsAdminApi.summary).mockImplementation(async (params) => {
      if (params.dateFrom && params.dateTo) {
        return todayPromise;
      }
      return thirtyDayPromise;
    });

    render(<DashboardSummaryStats roles={["manager"]} />);

    expect(screen.getAllByTestId("summary-stat-skeleton")).toHaveLength(3);
    expect(screen.queryByText(formatRupiah(350_000))).not.toBeInTheDocument();
    expect(screen.queryByText("7")).not.toBeInTheDocument();

    resolveToday({ data: todaySummary });
    resolveThirtyDay({ data: thirtyDaySummary });

    await waitFor(() => {
      expect(screen.queryAllByTestId("summary-stat-skeleton")).toHaveLength(0);
    });

    expect(screen.getByText(formatRupiah(350_000))).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText(formatRupiah(750_000))).toBeInTheDocument();
  });
});
