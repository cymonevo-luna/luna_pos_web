import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { TransactionSummaryChart } from "./transaction-summary-chart";
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

describe("TransactionSummaryChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(transactionsAdminApi.summary).mockResolvedValue({
      data: dailySummary,
    });
  });

  it("renders buckets with period labels and bar points", async () => {
    renderWithProviders(<TransactionSummaryChart />);

    const chart = await screen.findByTestId("transaction-chart");
    expect(chart).toBeInTheDocument();

    for (const bucket of dailySummary.buckets) {
      expect(within(chart).getByText(bucket.period_label)).toBeInTheDocument();
    }

    await waitFor(() => {
      expect(chart.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(3);
    });
  });

  it("refetches data when Weekly period is selected", async () => {
    const user = userEvent.setup();

    renderWithProviders(<TransactionSummaryChart />);
    await screen.findByTestId("transaction-chart");

    await user.click(screen.getByRole("button", { name: "Weekly" }));

    await waitFor(() => {
      expect(transactionsAdminApi.summary).toHaveBeenLastCalledWith(
        expect.objectContaining({ period: "weekly" }),
      );
    });
  });

  it("shows empty state when no buckets are returned", async () => {
    vi.mocked(transactionsAdminApi.summary).mockResolvedValue({
      data: { period: "daily", buckets: [] },
    });

    renderWithProviders(<TransactionSummaryChart />);

    expect(
      await screen.findByText("No transactions in this period"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("transaction-chart")).not.toBeInTheDocument();
  });

  it("shows error toast when loading fails", async () => {
    vi.mocked(transactionsAdminApi.summary).mockRejectedValue(
      new ApiError(500, "server_error", "Server error"),
    );

    renderWithProviders(<TransactionSummaryChart />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Server error");
    });
  });
});
