import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CashFlowOverviewStats } from "./cash-flow-overview-stats";
import { cashFlowAdminApi } from "@/lib/api/cash-flow";
import { formatRupiah } from "@/lib/utils";
import type { CashFlowSummary } from "@/lib/api/types";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";

vi.mock("@/lib/api/cash-flow", () => ({
  cashFlowAdminApi: {
    summary: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const todaySummary: CashFlowSummary = {
  period: "daily",
  totals: {
    inflow_amount: 1_200_000,
    inflow_count: 12,
    outflow_amount: 450_000,
    outflow_count: 2,
    net_amount: 750_000,
  },
  buckets: [],
};

const zeroSummary: CashFlowSummary = {
  period: "daily",
  totals: {
    inflow_amount: 0,
    inflow_count: 0,
    outflow_amount: 0,
    outflow_count: 0,
    net_amount: 0,
  },
  buckets: [],
};

describe("CashFlowOverviewStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cashFlowAdminApi.summary).mockResolvedValue({
      data: todaySummary,
    });
  });

  it("renders today's cash flow KPIs from the summary API", async () => {
    render(<CashFlowOverviewStats />);

    expect(await screen.findByText("Today's Inflow")).toBeInTheDocument();
    expect(screen.getByText(formatRupiah(1_200_000))).toBeInTheDocument();
    expect(screen.getByText("12 transactions")).toBeInTheDocument();
    expect(screen.getByText("Today's Outflow")).toBeInTheDocument();
    expect(screen.getByText(formatRupiah(450_000))).toBeInTheDocument();
    expect(screen.getByText("2 payments")).toBeInTheDocument();
    expect(screen.getByText("Today's Net Cash Flow")).toBeInTheDocument();
    expect(screen.getByText(formatRupiah(750_000))).toBeInTheDocument();
  });

  it("links to the cash flow details page", async () => {
    render(<CashFlowOverviewStats />);

    const link = await screen.findByRole("link", { name: "View details →" });
    expect(link).toHaveAttribute("href", "/admin/cash-flow");
  });

  it("shows loading skeletons before summary data resolves", async () => {
    let resolveSummary!: (value: { data: CashFlowSummary }) => void;
    const summaryPromise = new Promise<{ data: CashFlowSummary }>((resolve) => {
      resolveSummary = resolve;
    });

    vi.mocked(cashFlowAdminApi.summary).mockReturnValue(summaryPromise);

    render(<CashFlowOverviewStats />);

    expect(screen.getAllByTestId("cash-flow-overview-stat-skeleton")).toHaveLength(
      3,
    );
    expect(screen.queryByText(formatRupiah(1_200_000))).not.toBeInTheDocument();

    resolveSummary({ data: todaySummary });

    await waitFor(() => {
      expect(
        screen.queryAllByTestId("cash-flow-overview-stat-skeleton"),
      ).toHaveLength(0);
    });

    expect(screen.getByText(formatRupiah(1_200_000))).toBeInTheDocument();
  });

  it("shows zero amounts when today has no cash flow activity", async () => {
    vi.mocked(cashFlowAdminApi.summary).mockResolvedValue({
      data: zeroSummary,
    });

    render(<CashFlowOverviewStats />);

    await screen.findByText("Today's Inflow");
    expect(screen.getAllByText(formatRupiah(0))).toHaveLength(3);
    expect(screen.getByText("0 transactions")).toBeInTheDocument();
    expect(screen.getByText("0 payments")).toBeInTheDocument();
  });

  it("shows placeholders and toasts on API error", async () => {
    vi.mocked(cashFlowAdminApi.summary).mockRejectedValue(
      new ApiError(500, "server_error", "Cash flow unavailable"),
    );

    render(<CashFlowOverviewStats />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Cash flow unavailable");
    });

    expect(screen.getAllByText("—")).toHaveLength(3);
  });
});
