import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AdminCogsSummaryPage from "./page";
import { cogsAdminApi } from "@/lib/api/cogs";
import { ApiError } from "@/lib/api/client";
import type { CogsPortfolioSummary } from "@/lib/api/types";
import { toast } from "sonner";

vi.mock("@/lib/api/cogs", () => ({
  cogsAdminApi: {
    list: vi.fn(),
    get: vi.fn(),
    exportCsv: vi.fn(),
    portfolioSummary: vi.fn(),
  },
  downloadCogsCsv: vi.fn(),
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

const portfolioSummary: CogsPortfolioSummary = {
  generated_at: "2026-07-18T03:00:00.000Z",
  total_menus: 5,
  complete_count: 3,
  missing_prices_count: 1,
  no_formula_count: 1,
  avg_margin_percent: 28.5,
  avg_cogs_per_piece: 12500,
  variance: {
    total_recommended_sell_price: 110000,
    total_current_sell_price: 125000,
    variance_amount: -15000,
    variance_percent: -12,
  },
  categories: [
    {
      category_id: "cat-main",
      category_name: "Main",
      menu_count: 3,
      complete_count: 2,
      avg_margin_percent: 30,
      avg_cogs_per_piece: 15000,
    },
    {
      category_id: "cat-drinks",
      category_name: "Drinks",
      menu_count: 2,
      complete_count: 1,
      avg_margin_percent: 25,
      avg_cogs_per_piece: 8000,
    },
  ],
};

describe("AdminCogsSummaryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cogsAdminApi.portfolioSummary).mockResolvedValue({
      data: portfolioSummary,
    });
  });

  it("renders page title and stat cards after loading", async () => {
    render(<AdminCogsSummaryPage />);

    expect(screen.getByText("COGS Summary")).toBeInTheDocument();
    expect(screen.getAllByTestId("cogs-summary-stat-skeleton").length).toBe(6);

    expect(await screen.findByText("Total menus")).toBeInTheDocument();
    expect(screen.getByText("Complete COGS")).toBeInTheDocument();
    expect(screen.getAllByText("Missing prices").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No formula").length).toBeGreaterThan(0);
    expect(screen.getByText("Average margin")).toBeInTheDocument();
    expect(screen.getByText("Average COGS per piece")).toBeInTheDocument();
    expect(screen.getByText("28.5%")).toBeInTheDocument();
    expect(screen.getByText("Rp 12.500")).toBeInTheDocument();
    expect(screen.getByText(/Generated/)).toBeInTheDocument();
  });

  it("shows category breakdown table with one row per category", async () => {
    render(<AdminCogsSummaryPage />);

    expect(
      await screen.findByTestId("cogs-summary-category-table"),
    ).toBeInTheDocument();
    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByText("Drinks")).toBeInTheDocument();
    expect(screen.getAllByText("Rp 15.000").length).toBeGreaterThan(0);
    expect(screen.getByText("Rp 8.000")).toBeInTheDocument();
  });

  it("shows variance card when API provides variance data", async () => {
    render(<AdminCogsSummaryPage />);

    expect(
      await screen.findByTestId("cogs-summary-variance-card"),
    ).toBeInTheDocument();
    expect(screen.getByText("Sell price variance")).toBeInTheDocument();
    expect(screen.getAllByText("Rp 110.000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rp 125.000").length).toBeGreaterThan(0);
  });

  it("shows empty state when merchant has no menus", async () => {
    vi.mocked(cogsAdminApi.portfolioSummary).mockResolvedValue({
      data: {
        generated_at: "2026-07-18T03:00:00.000Z",
        total_menus: 0,
        complete_count: 0,
        missing_prices_count: 0,
        no_formula_count: 0,
        avg_margin_percent: 0,
        avg_cogs_per_piece: null,
        categories: [],
      },
    });

    render(<AdminCogsSummaryPage />);

    expect(await screen.findByText("Total menus")).toBeInTheDocument();
    expect(
      screen.getByText("No menus yet. Add menus to see COGS summary data."),
    ).toBeInTheDocument();
    expect(screen.getByText("No menu data to chart")).toBeInTheDocument();
    expect(
      screen.queryByTestId("cogs-summary-variance-card"),
    ).not.toBeInTheDocument();
  });

  it("shows error toast and does not crash when API fails", async () => {
    vi.mocked(cogsAdminApi.portfolioSummary).mockRejectedValue(
      new ApiError(503, "service_unavailable", "Portfolio summary unavailable"),
    );

    render(<AdminCogsSummaryPage />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Portfolio summary unavailable");
    });

    expect(screen.getByText("COGS Summary")).toBeInTheDocument();
    expect(screen.getByText("Total menus")).toBeInTheDocument();
  });
});
