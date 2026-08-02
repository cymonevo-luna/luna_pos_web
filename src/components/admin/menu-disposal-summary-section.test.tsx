import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { MenuDisposalSummarySection } from "./menu-disposal-summary-section";
import { menuDisposalsAdminApi } from "@/lib/api/menu-disposals";
import { ApiError } from "@/lib/api/client";
import { defaultReportRange } from "@/lib/datetime";
import { toast } from "sonner";

vi.mock("@/lib/datetime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/datetime")>();
  return {
    ...actual,
    defaultReportRange: vi.fn(actual.defaultReportRange),
  };
});

vi.mock("@/lib/api/menu-disposals", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/menu-disposals")>();
  return {
    ...actual,
    menuDisposalsAdminApi: {
      ...actual.menuDisposalsAdminApi,
      summary: vi.fn(),
      summaryByMenu: vi.fn(),
    },
  };
});

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

const sampleSummary = {
  period: "daily" as const,
  date_from: "2026-01-01T00:00:00.000Z",
  date_to: "2026-01-31T23:59:59.999Z",
  totals: { count: 5, total_amount: 150_000, total_quantity: 8 },
  buckets: [
    {
      period_start: "2026-01-15T00:00:00Z",
      period_label: "Jan 15",
      count: 3,
      total_amount: 90_000,
      total_quantity: 5,
    },
    {
      period_start: "2026-01-16T00:00:00Z",
      period_label: "Jan 16",
      count: 2,
      total_amount: 60_000,
      total_quantity: 3,
    },
  ],
};

const sampleByMenu = {
  period: "daily" as const,
  date_from: "2026-01-01T00:00:00.000Z",
  date_to: "2026-01-31T23:59:59.999Z",
  total_loss_amount: 150_000,
  total_quantity: 8,
  total_count: 5,
  menus: [
    {
      menu_id: "menu-1",
      menu_title: "Nasi Goreng",
      disposal_count: 3,
      quantity_disposed: 5,
      loss_amount: 90_000,
      loss_share_percent: 60,
      quantity_share_percent: 62.5,
    },
    {
      menu_id: "menu-2",
      menu_title: "Mie Goreng",
      disposal_count: 2,
      quantity_disposed: 3,
      loss_amount: 60_000,
      loss_share_percent: 40,
      quantity_share_percent: 37.5,
    },
  ],
};

describe("MenuDisposalSummarySection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(menuDisposalsAdminApi.summary).mockResolvedValue({
      data: sampleSummary,
    });
    vi.mocked(menuDisposalsAdminApi.summaryByMenu).mockResolvedValue({
      data: sampleByMenu,
    });
  });

  it("renders stat cards with formatted totals from API", async () => {
    renderWithProviders(<MenuDisposalSummarySection />);

    expect(await screen.findByText("Rp 150.000")).toBeInTheDocument();
    expect(screen.getByText("Total loss")).toBeInTheDocument();
    expect(screen.getByText("Disposal count")).toBeInTheDocument();
    expect(screen.getByText("5 disposals")).toBeInTheDocument();
    expect(screen.getByText("Total quantity")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("refetches summary when period toggle changes to weekly", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MenuDisposalSummarySection />);
    await screen.findByText("Rp 150.000");

    await user.click(screen.getByRole("button", { name: "Weekly" }));

    await waitFor(() => {
      expect(menuDisposalsAdminApi.summary).toHaveBeenLastCalledWith(
        expect.objectContaining({ period: "weekly" }),
      );
      expect(menuDisposalsAdminApi.summaryByMenu).toHaveBeenLastCalledWith(
        expect.objectContaining({ period: "weekly" }),
      );
    });
  });

  it("shows trend chart empty state when buckets are empty", async () => {
    vi.mocked(menuDisposalsAdminApi.summary).mockResolvedValue({
      data: { ...sampleSummary, buckets: [] },
    });

    renderWithProviders(<MenuDisposalSummarySection />);

    expect(
      await screen.findByText("No disposals in this period"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("menu-disposal-trend-chart"),
    ).not.toBeInTheDocument();
  });

  it("renders pie chart with menu titles when by-menu data is available", async () => {
    renderWithProviders(<MenuDisposalSummarySection />);

    expect(
      await screen.findByTestId("menu-disposal-menu-pie-chart"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Nasi Goreng").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mie Goreng").length).toBeGreaterThan(0);
  });

  it("shows error toast when summary API fails", async () => {
    vi.mocked(menuDisposalsAdminApi.summary).mockRejectedValue(
      new ApiError(500, "server_error", "Summary unavailable"),
    );

    renderWithProviders(<MenuDisposalSummarySection />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Summary unavailable");
    });
  });

  it("uses default report range for initial date inputs", async () => {
    const range = { dateFrom: "2026-06-25", dateTo: "2026-07-25" };
    vi.mocked(defaultReportRange).mockReturnValue(range);

    renderWithProviders(<MenuDisposalSummarySection />);
    await screen.findByText("Rp 150.000");

    expect(screen.getByTestId("menu-disposal-summary-date-from")).toHaveValue(
      range.dateFrom,
    );
    expect(screen.getByTestId("menu-disposal-summary-date-to")).toHaveValue(
      range.dateTo,
    );
  });
});
