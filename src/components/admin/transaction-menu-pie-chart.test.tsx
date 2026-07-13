import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransactionMenuPieChart } from "./transaction-menu-pie-chart";
import { transactionMenuInsights } from "@/lib/api/insights";
import type { TransactionMenuInsights } from "@/lib/api/types";

vi.mock("@/lib/api/insights", () => ({
  transactionMenuInsights: vi.fn(),
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

const sampleInsights: TransactionMenuInsights = {
  date_from: "2026-01-01T00:00:00.000Z",
  date_to: "2026-01-31T23:59:59.999Z",
  total_revenue: 500_000,
  menus: [
    {
      menu_id: "menu-1",
      menu_title: "Nasi Goreng",
      quantity_sold: 20,
      revenue: 300_000,
      share_percent: 60,
    },
    {
      menu_id: "menu-2",
      menu_title: "Mie Goreng",
      quantity_sold: 10,
      revenue: 200_000,
      share_percent: 40,
    },
  ],
};

describe("TransactionMenuPieChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(transactionMenuInsights).mockResolvedValue({
      data: sampleInsights,
    });
  });

  it("renders pie chart when menu data is available", async () => {
    render(<TransactionMenuPieChart />);

    expect(await screen.findByTestId("menu-pie-chart")).toBeInTheDocument();
  });

  it("renders menu table rows", async () => {
    render(<TransactionMenuPieChart />);

    expect(await screen.findByText("Nasi Goreng")).toBeInTheDocument();
    expect(screen.getAllByText("Mie Goreng").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rp 300.000").length).toBeGreaterThan(0);
  });
});
