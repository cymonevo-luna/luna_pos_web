import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { TransactionSummaryStats } from "./transaction-summary-stats";
import { transactionsAdminApi } from "@/lib/api/transactions";
import { ApiError } from "@/lib/api/client";
import { formatRupiah } from "@/lib/utils";
import * as wib from "@/lib/datetime/wib";
import type { TransactionSummary } from "@/lib/api/types";

vi.mock("@/lib/api/transactions", () => ({
  transactionsAdminApi: {
    summary: vi.fn(),
  },
}));

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

function mockPeriodSummaries() {
  vi.mocked(transactionsAdminApi.summary).mockImplementation(
    async (params) => {
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

describe("TransactionSummaryStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders today, week, and month stat cards with totals", async () => {
    mockPeriodSummaries();

    renderWithProviders(<TransactionSummaryStats />);

    expect(await screen.findByText("Today")).toBeInTheDocument();
    expect(screen.getByText("This week")).toBeInTheDocument();
    expect(screen.getByText("This month")).toBeInTheDocument();
    expect(screen.getByText(formatRupiah(100_000))).toBeInTheDocument();
    expect(screen.getByText("5 transactions")).toBeInTheDocument();
    expect(screen.getByText(formatRupiah(500_000))).toBeInTheDocument();
    expect(screen.getByText("20 transactions")).toBeInTheDocument();
    expect(screen.getByText(formatRupiah(2_000_000))).toBeInTheDocument();
    expect(screen.getByText("80 transactions")).toBeInTheDocument();
  });

  it("shows zero values when summary buckets are empty", async () => {
    const emptySummary: TransactionSummary = { period: "daily", buckets: [] };
    vi.mocked(transactionsAdminApi.summary).mockResolvedValue({
      data: emptySummary,
    });

    renderWithProviders(<TransactionSummaryStats />);

    expect(await screen.findAllByText(formatRupiah(0))).toHaveLength(3);
    expect(screen.getAllByText("0 transactions")).toHaveLength(3);
  });

  it("calls summary API with WIB preset date ranges", async () => {
    vi.spyOn(wib, "todayWIB").mockReturnValue("2026-07-25");

    vi.mocked(transactionsAdminApi.summary).mockResolvedValue({
      data: { period: "daily", buckets: [] },
    });

    renderWithProviders(<TransactionSummaryStats />);

    await waitFor(() => {
      expect(transactionsAdminApi.summary).toHaveBeenCalledWith({
        period: "daily",
        dateFrom: "2026-07-25",
        dateTo: "2026-07-25",
      });
    });
    expect(transactionsAdminApi.summary).toHaveBeenCalledWith({
      period: "daily",
      dateFrom: "2026-07-20",
      dateTo: "2026-07-25",
    });
    expect(transactionsAdminApi.summary).toHaveBeenCalledWith({
      period: "daily",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-25",
    });
  });

  it("shows placeholder for failed summary without breaking layout", async () => {
    mockPeriodSummaries();
    vi.mocked(transactionsAdminApi.summary).mockImplementation(
      async (params) => {
        if (params.dateFrom === params.dateTo) {
          throw new ApiError(500, "server_error", "Summary failed");
        }
        if (params.dateFrom?.endsWith("-01")) {
          return { data: monthSummary };
        }
        return { data: weekSummary };
      },
    );

    renderWithProviders(<TransactionSummaryStats />);

    expect(await screen.findByText("Today")).toBeInTheDocument();
    expect(screen.getByText("This week")).toBeInTheDocument();
    expect(screen.getByText("This month")).toBeInTheDocument();

    const placeholders = screen.getAllByText("—");
    expect(placeholders.length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText(formatRupiah(500_000))).toBeInTheDocument();
    expect(screen.getByText("20 transactions")).toBeInTheDocument();
    expect(screen.getByText(formatRupiah(2_000_000))).toBeInTheDocument();
    expect(screen.getByText("80 transactions")).toBeInTheDocument();
  });
});
