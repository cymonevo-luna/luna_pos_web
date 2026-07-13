import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TransactionMenuPieChart } from "./transaction-menu-pie-chart";
import type { TransactionMenuInsightsRaw } from "@/lib/api/types";
import { tokenStore } from "@/lib/auth/tokens";
import { toast } from "sonner";

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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Backend-shaped payload from GET /api/admin/insights/transactions/by-menu. */
const backendInsights: TransactionMenuInsightsRaw = {
  date_from: "2026-01-01T00:00:00.000Z",
  date_to: "2026-01-31T23:59:59.999Z",
  total_revenue: 500_000,
  menus: [
    {
      menu_id: "menu-1",
      menu_title: "Nasi Goreng",
      quantity_sold: 20,
      revenue: 300_000,
      revenue_share_percent: 60,
      quantity_share_percent: 66.7,
    },
    {
      menu_id: "menu-2",
      menu_title: "Mie Goreng",
      quantity_sold: 10,
      revenue: 200_000,
      revenue_share_percent: 40,
      quantity_share_percent: 33.3,
    },
  ],
};

describe("TransactionMenuPieChart", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: backendInsights }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders pie chart when menu data is available", async () => {
    render(<TransactionMenuPieChart />);

    expect(await screen.findByTestId("menu-pie-chart")).toBeInTheDocument();
  });

  it("renders menu table rows with share from revenue_share_percent", async () => {
    render(<TransactionMenuPieChart />);

    expect(await screen.findByText("Nasi Goreng")).toBeInTheDocument();
    expect(screen.getAllByText("Mie Goreng").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rp 300.000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("60.0%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("40.0%").length).toBeGreaterThan(0);
  });

  it("shows error toast when loading fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: { code: "server_error", message: "Server error" },
        },
        500,
      ),
    );

    render(<TransactionMenuPieChart />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Server error");
    });
    expect(screen.queryByTestId("menu-pie-chart")).not.toBeInTheDocument();
    expect(screen.getAllByText("No menu sales in this period").length).toBeGreaterThan(
      0,
    );
  });
});
