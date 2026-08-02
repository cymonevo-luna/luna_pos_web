import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { TransactionTrendChart } from "./transaction-trend-chart";
import { transactionsAdminApi } from "@/lib/api/transactions";
import { ApiError } from "@/lib/api/client";
import type { TransactionSummary } from "@/lib/api/types";
import { toast } from "sonner";

vi.mock("@/lib/api/transactions", () => ({
  transactionsAdminApi: {
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

const dailySummary: TransactionSummary = {
  period: "daily",
  buckets: [
    {
      period_start: "2026-01-01T00:00:00Z",
      period_label: "Jan 1",
      count: 3,
      total_amount: 150000,
    },
    {
      period_start: "2026-01-02T00:00:00Z",
      period_label: "Jan 2",
      count: 5,
      total_amount: 250000,
    },
    {
      period_start: "2026-01-03T00:00:00Z",
      period_label: "Jan 3",
      count: 2,
      total_amount: 80000,
    },
  ],
};

describe("TransactionTrendChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(transactionsAdminApi.summary).mockResolvedValue({
      data: dailySummary,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders dual metrics from API data with legend entries", async () => {
    renderWithProviders(<TransactionTrendChart />);

    const chart = await screen.findByTestId("transaction-trend-chart");
    expect(chart).toBeInTheDocument();
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("Transactions")).toBeInTheDocument();

    for (const bucket of dailySummary.buckets) {
      expect(within(chart).getByText(bucket.period_label)).toBeInTheDocument();
    }

    await waitFor(() => {
      expect(chart.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(3);
    });
    await waitFor(() => {
      expect(chart.querySelectorAll(".recharts-line-curve")).toHaveLength(1);
    });
  });

  it("refetches data when Weekly and Monthly periods are selected", async () => {
    const user = userEvent.setup();

    renderWithProviders(<TransactionTrendChart />);
    await screen.findByTestId("transaction-trend-chart");

    await user.click(screen.getByRole("button", { name: "Weekly" }));

    await waitFor(() => {
      expect(transactionsAdminApi.summary).toHaveBeenLastCalledWith(
        expect.objectContaining({ period: "weekly" }),
      );
    });

    await user.click(screen.getByRole("button", { name: "Monthly" }));

    await waitFor(() => {
      expect(transactionsAdminApi.summary).toHaveBeenLastCalledWith(
        expect.objectContaining({ period: "monthly" }),
      );
    });
  });

  it("refetches summary when date range inputs change", async () => {
    const user = userEvent.setup();

    renderWithProviders(<TransactionTrendChart />);
    await screen.findByTestId("transaction-trend-chart");

    await user.clear(screen.getByLabelText("Trend chart date from"));
    await user.type(screen.getByLabelText("Trend chart date from"), "2026-01-01");

    await waitFor(() => {
      expect(transactionsAdminApi.summary).toHaveBeenLastCalledWith(
        expect.objectContaining({ dateFrom: "2026-01-01" }),
      );
    });

    await user.clear(screen.getByLabelText("Trend chart date to"));
    await user.type(screen.getByLabelText("Trend chart date to"), "2026-01-31");

    await waitFor(() => {
      expect(transactionsAdminApi.summary).toHaveBeenLastCalledWith(
        expect.objectContaining({ dateTo: "2026-01-31" }),
      );
    });
  });

  it("shows empty state when no buckets are returned", async () => {
    vi.mocked(transactionsAdminApi.summary).mockResolvedValue({
      data: { period: "daily", buckets: [] },
    });

    renderWithProviders(<TransactionTrendChart />);

    expect(
      await screen.findByText("No transactions in this period"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("transaction-trend-chart"),
    ).not.toBeInTheDocument();
  });

  it("shows error toast when loading fails", async () => {
    vi.mocked(transactionsAdminApi.summary).mockRejectedValue(
      new ApiError(500, "server_error", "Server error"),
    );

    renderWithProviders(<TransactionTrendChart />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Server error");
    });
  });
});
