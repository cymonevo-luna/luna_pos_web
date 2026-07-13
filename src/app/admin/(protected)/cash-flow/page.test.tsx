import React from "react";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AdminCashFlowPage from "./page";
import { tokenStore } from "@/lib/auth/tokens";
import type {
  ProductionNextDayInsightRaw,
  TransactionMenuInsightsRaw,
} from "@/lib/api/types";

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

/** Backend-shaped payload from GET /api/admin/insights/cash-flow/summary. */
const cashFlowSummaryBackend = {
  period: "daily" as const,
  totals: {
    inflow_amount: 1_500_000,
    inflow_count: 10,
    outflow_amount: 500_000,
    outflow_count: 2,
    net_amount: 1_000_000,
  },
  buckets: [
    {
      period_start: "2026-01-01T00:00:00Z",
      period_label: "Jan 1",
      inflow_amount: 800_000,
      outflow_amount: 200_000,
      net_amount: 600_000,
    },
  ],
  inflow_by_method: [
    { method: "CASH", total_amount: 1_000_000, count: 7 },
    { method: "QRIS", total_amount: 500_000, count: 3 },
  ],
};

/** Backend-shaped payload from GET /api/admin/insights/transactions/by-menu. */
const transactionMenuInsightsBackend: TransactionMenuInsightsRaw = {
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

/** Backend-shaped payload from GET /api/admin/insights/production/next-day. */
const productionNextDayBackend: ProductionNextDayInsightRaw = {
  target_date: "2026-07-14",
  lookback_days: 14,
  generated_at: "2026-07-13T10:00:00.000Z",
  menus: [
    {
      menu_id: "menu-1",
      menu_title: "Nasi Goreng",
      current_available_stock: 5,
      avg_daily_sales: 8,
      projected_demand: 10,
      recommended_production_qty: 5,
      max_producible_from_ingredients: 12,
      confidence: "high",
      is_limited_by_ingredients: false,
    },
    {
      menu_id: "menu-2",
      menu_title: "Mie Goreng",
      current_available_stock: 20,
      avg_daily_sales: 3,
      projected_demand: 4,
      recommended_production_qty: 3,
      max_producible_from_ingredients: 3,
      confidence: "medium",
      is_limited_by_ingredients: true,
    },
  ],
};

function mockInsightsFetch(
  productionPayload: ProductionNextDayInsightRaw = productionNextDayBackend,
) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = String(input);

    if (url.includes("/api/admin/insights/cash-flow/summary")) {
      return Promise.resolve(
        jsonResponse({ success: true, data: cashFlowSummaryBackend }),
      );
    }

    if (url.includes("/api/admin/insights/transactions/by-menu")) {
      return Promise.resolve(
        jsonResponse({ success: true, data: transactionMenuInsightsBackend }),
      );
    }

    if (url.includes("/api/admin/insights/production/next-day")) {
      return Promise.resolve(
        jsonResponse({ success: true, data: productionPayload }),
      );
    }

    return Promise.reject(new Error(`Unhandled fetch in cash-flow integration: ${url}`));
  });
}

describe("AdminCashFlowPage", () => {
  describe("composition", () => {
    it("renders all three section shells", () => {
      render(<AdminCashFlowPage />);

      expect(screen.getByTestId("cash-flow-page")).toBeInTheDocument();
      expect(screen.getByTestId("cash-flow-section")).toBeInTheDocument();
      expect(screen.getByTestId("transaction-menu-insights")).toBeInTheDocument();
      expect(screen.getByTestId("production-insight-panel")).toBeInTheDocument();
    });
  });

  describe("integration", () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      tokenStore.clear();
      vi.restoreAllMocks();
      mockInsightsFetch();
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      vi.restoreAllMocks();
    });

    it("renders real child sections with backend-shaped insights payloads", async () => {
      render(<AdminCashFlowPage />);

      expect(screen.getByTestId("cash-flow-page")).toBeInTheDocument();
      expect(screen.getByTestId("cash-flow-section")).toBeInTheDocument();
      expect(screen.getByTestId("transaction-menu-insights")).toBeInTheDocument();
      expect(screen.getByTestId("production-insight-panel")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText("Rp 1.500.000")).toBeInTheDocument();
      });

      expect(screen.getAllByText("60.0%").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Nasi Goreng").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Mie Goreng").length).toBeGreaterThan(0);
      expect(screen.getByTestId("cash-flow-chart")).toBeInTheDocument();
      expect(screen.getByTestId("menu-pie-chart")).toBeInTheDocument();
      expect(screen.queryByText("Rp NaN")).not.toBeInTheDocument();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("renders all sections when production insight row omits avg_daily_sales", async () => {
      const malformedProductionPayload: ProductionNextDayInsightRaw = {
        ...productionNextDayBackend,
        menus: [
          {
            ...productionNextDayBackend.menus[0],
            avg_daily_sales: undefined as unknown as number,
          },
          productionNextDayBackend.menus[1],
        ],
      };

      vi.restoreAllMocks();
      mockInsightsFetch(malformedProductionPayload);
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(<AdminCashFlowPage />);

      expect(screen.getByTestId("cash-flow-page")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId("cash-flow-section")).toBeInTheDocument();
        expect(screen.getByTestId("transaction-menu-insights")).toBeInTheDocument();
        expect(screen.getByTestId("production-insight-panel")).toBeInTheDocument();
      });

      expect(screen.getAllByText("Nasi Goreng").length).toBeGreaterThan(0);
      expect(screen.getByText("0.0")).toBeInTheDocument();

      const toFixedErrors = consoleErrorSpy.mock.calls.filter(
        ([message]: [unknown, ...unknown[]]) =>
          typeof message === "string" &&
          message.includes("toFixed") &&
          message.includes("TypeError"),
      );
      expect(toFixedErrors).toHaveLength(0);
    });
  });
});
