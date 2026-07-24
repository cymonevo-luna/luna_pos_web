import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CashFlowSection } from "./cash-flow-section";
import { ApiError } from "@/lib/api/client";
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

const sampleSummary = {
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
      production_cost_amount: 50_000,
    },
  ],
  inflow_by_method: [
    { method: "CASH", total_amount: 1_000_000, count: 7 },
    { method: "QRIS", total_amount: 500_000, count: 3 },
  ],
  outflow_by_source: [
    { source: "purchases", total_amount: 300_000, count: 1 },
    { source: "expenses", total_amount: 150_000, count: 1 },
    { source: "staff_payouts", total_amount: 50_000, count: 1 },
    { source: "menu_disposals", total_amount: 75_000, count: 2 },
  ],
  production_cost: {
    total_estimated_cost: 50_000,
    completed_request_count: 2,
    items_without_cogs_count: 1,
  },
};

describe("CashFlowSection", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: sampleSummary }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders formatted currency stat cards", async () => {
    render(<CashFlowSection />);

    expect(await screen.findByText("Total outflow")).toBeInTheDocument();
    expect(screen.getByText("Net cash flow")).toBeInTheDocument();
    expect(screen.getAllByText("Customer transactions").length).toBeGreaterThan(0);
    expect(screen.getByText("Rp 1.500.000")).toBeInTheDocument();
    expect(screen.getAllByText("Rp 500.000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rp 1.000.000").length).toBeGreaterThan(0);
  });

  it("shows outflow breakdown chart and production cost card when API returns extended fields", async () => {
    render(<CashFlowSection />);

    expect(
      await screen.findByTestId("cash-flow-outflow-breakdown"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("cash-flow-production-cost-card"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Production cost").length).toBeGreaterThan(0);
    expect(
      within(screen.getByTestId("cash-flow-production-cost-card")).getByText(
        "Rp 50.000",
      ),
    ).toBeInTheDocument();
    const outflowBreakdown = screen.getByTestId("cash-flow-outflow-breakdown");
    expect(within(outflowBreakdown).getAllByText("Purchases").length).toBeGreaterThan(0);
    expect(within(outflowBreakdown).getAllByText("Expenses").length).toBeGreaterThan(0);
    expect(within(outflowBreakdown).getAllByText("Staff payouts").length).toBeGreaterThan(0);
    expect(within(outflowBreakdown).getAllByText("Menu Disposals").length).toBeGreaterThan(0);
    expect(within(outflowBreakdown).getAllByText("Rp 75.000").length).toBeGreaterThan(0);
    expect(
      screen.getByTestId("cash-flow-production-cost-warning"),
    ).toHaveTextContent("1 without COGS");
  });

  it("hides extended sections when API omits optional fields", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          ...sampleSummary,
          outflow_by_source: undefined,
          production_cost: undefined,
          buckets: sampleSummary.buckets.map(({ production_cost_amount, ...bucket }) => bucket),
        },
      }),
    );

    render(<CashFlowSection />);

    expect(await screen.findByText("Total outflow")).toBeInTheDocument();
    expect(
      screen.queryByTestId("cash-flow-outflow-breakdown"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("cash-flow-production-cost-card"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("cash-flow-chart")).toBeInTheDocument();
  });

  it("shows inflow-by-method breakdown with mapped amounts", async () => {
    render(<CashFlowSection />);

    expect(
      await screen.findByTestId("cash-flow-inflow-by-method"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Customer transactions by payment method"),
    ).toBeInTheDocument();
    expect(screen.getByText("CASH")).toBeInTheDocument();
    expect(screen.getByText("QRIS")).toBeInTheDocument();
    expect(screen.getAllByText("Rp 1.000.000").length).toBeGreaterThan(0);
    expect(screen.queryByText("Rp NaN")).not.toBeInTheDocument();
  });

  it("hides inflow-by-method legend when empty", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: { ...sampleSummary, inflow_by_method: [] },
      }),
    );

    render(<CashFlowSection />);

    expect(await screen.findByText("Total outflow")).toBeInTheDocument();
    expect(
      screen.queryByTestId("cash-flow-inflow-by-method"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("cash-flow-chart")).toBeInTheDocument();
  });

  it("refetches when date range changes", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<CashFlowSection />);
    await screen.findByText("Rp 1.500.000");

    await user.clear(screen.getByLabelText("Cash flow date from"));
    await user.type(screen.getByLabelText("Cash flow date from"), "2026-01-01");

    await waitFor(() => {
      const lastCall = fetchMock.mock.calls.at(-1);
      expect(lastCall?.[0]).toContain("date_from=2026-01-01");
    });
  });

  it("shows error toast when loading fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        { success: false, error: { code: "server_error", message: "Server error" } },
        500,
      ),
    );

    render(<CashFlowSection />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Server error");
    });
  });

  describe("POS-79-6 expense outflow reflection", () => {
    const baseInflow = 2_000_000;
    const baseOutflow = 500_000;
    const expenseAmount = 100_000;

    function summaryWithOutflow(outflowAmount: number) {
      return {
        period: "daily" as const,
        totals: {
          inflow_amount: baseInflow,
          inflow_count: 15,
          outflow_amount: outflowAmount,
          outflow_count: 3,
          net_amount: baseInflow - outflowAmount,
        },
        buckets: [
          {
            period_start: "2026-07-17T00:00:00Z",
            period_label: "Jul 17",
            inflow_amount: baseInflow,
            outflow_amount: outflowAmount,
            net_amount: baseInflow - outflowAmount,
          },
        ],
        inflow_by_method: [
          { method: "CASH", total_amount: 1_200_000, count: 10 },
          { method: "QRIS", total_amount: 800_000, count: 5 },
        ],
      };
    }

    it("renders backend outflow totals that include expenses", async () => {
      const outflowWithExpense = baseOutflow + expenseAmount;
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse({
          success: true,
          data: summaryWithOutflow(outflowWithExpense),
        }),
      );

      render(<CashFlowSection />);

      expect(await screen.findByText("Rp 2.000.000")).toBeInTheDocument();
      expect(screen.getAllByText("Rp 600.000").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Rp 1.400.000").length).toBeGreaterThan(0);
    });

    it("keeps inflow unchanged when only outflow increases after an expense", async () => {
      const outflowWithExpense = baseOutflow + expenseAmount;
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse({
          success: true,
          data: summaryWithOutflow(outflowWithExpense),
        }),
      );

      render(<CashFlowSection />);

      await screen.findByText("Total outflow");
      expect(screen.getByText("Rp 2.000.000")).toBeInTheDocument();
      expect(screen.getByText("CASH")).toBeInTheDocument();
      expect(screen.getByText("QRIS")).toBeInTheDocument();
      expect(screen.getAllByText("Rp 600.000").length).toBeGreaterThan(0);
    });

    it("refetches and shows higher outflow after date range change", async () => {
      const user = userEvent.setup();
      let outflowAmount = baseOutflow;
      const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
        Promise.resolve(
          jsonResponse({
            success: true,
            data: summaryWithOutflow(outflowAmount),
          }),
        ),
      );

      render(<CashFlowSection />);
      await screen.findByText("Rp 500.000");

      outflowAmount = baseOutflow + expenseAmount;
      await user.clear(screen.getByLabelText("Cash flow date from"));
      await user.type(screen.getByLabelText("Cash flow date from"), "2026-07-17");

      await waitFor(() => {
        expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
        expect(screen.getAllByText("Rp 600.000").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Rp 1.400.000").length).toBeGreaterThan(0);
      });
    });

    it("renders bucket chart from buckets[].outflow_amount without hard-coded sources", async () => {
      const outflowWithExpense = baseOutflow + expenseAmount;
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse({
          success: true,
          data: summaryWithOutflow(outflowWithExpense),
        }),
      );

      render(<CashFlowSection />);

      expect(await screen.findByTestId("cash-flow-chart")).toBeInTheDocument();
      expect(screen.queryByText(/purchase request/i)).not.toBeInTheDocument();
      expect(screen.queryByText("Inflows, outflows, and net cash movement")).not.toBeInTheDocument();
      expect(
        screen.getByText("Customer transaction inflows, outflows, and net cash movement"),
      ).toBeInTheDocument();
    });
  });

  describe("POS-141-6 menu disposal outflow", () => {
    it("shows menu disposals in outflow breakdown when API returns menu_disposals source", async () => {
      render(<CashFlowSection />);

      const outflowBreakdown = await screen.findByTestId(
        "cash-flow-outflow-breakdown",
      );
      expect(
        within(outflowBreakdown).getAllByText("Menu Disposals").length,
      ).toBeGreaterThan(0);
      expect(
        within(outflowBreakdown).getAllByText("Rp 75.000").length,
      ).toBeGreaterThan(0);
      expect(
        within(outflowBreakdown).getByText("(2 payments)"),
      ).toBeInTheDocument();
    });

    it("renders backend outflow totals that include menu disposals without double-counting", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse({
          success: true,
          data: {
            period: "daily",
            totals: {
              inflow_amount: 2_000_000,
              inflow_count: 15,
              outflow_amount: 575_000,
              outflow_count: 5,
              net_amount: 1_425_000,
            },
            buckets: [
              {
                period_start: "2026-07-24T00:00:00Z",
                period_label: "Jul 24",
                inflow_amount: 2_000_000,
                outflow_amount: 575_000,
                net_amount: 1_425_000,
              },
            ],
            outflow_by_source: [
              { source: "purchases", total_amount: 300_000, count: 1 },
              { source: "expenses", total_amount: 150_000, count: 1 },
              { source: "staff_payouts", total_amount: 50_000, count: 1 },
              { source: "menu_disposals", total_amount: 75_000, count: 2 },
            ],
          },
        }),
      );

      render(<CashFlowSection />);

      expect(await screen.findByText("Rp 575.000")).toBeInTheDocument();
      expect(screen.getAllByText("Rp 1.425.000").length).toBeGreaterThan(0);
      const outflowBreakdown = screen.getByTestId("cash-flow-outflow-breakdown");
      expect(
        within(outflowBreakdown).getAllByText("Menu Disposals").length,
      ).toBeGreaterThan(0);
    });

    it("omits menu disposals segment when API omits menu_disposals source", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse({
          success: true,
          data: {
            ...sampleSummary,
            outflow_by_source: [
              { source: "purchases", total_amount: 300_000, count: 1 },
              { source: "expenses", total_amount: 150_000, count: 1 },
              { source: "staff_payouts", total_amount: 50_000, count: 1 },
            ],
          },
        }),
      );

      render(<CashFlowSection />);

      const outflowBreakdown = await screen.findByTestId(
        "cash-flow-outflow-breakdown",
      );
      expect(
        within(outflowBreakdown).queryByText("Menu Disposals"),
      ).not.toBeInTheDocument();
    });

    it("shows zero menu disposals when API returns menu_disposals with zero amount", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse({
          success: true,
          data: {
            ...sampleSummary,
            outflow_by_source: [
              { source: "purchases", total_amount: 300_000, count: 1 },
              { source: "menu_disposals", total_amount: 0, count: 0 },
            ],
          },
        }),
      );

      render(<CashFlowSection />);

      const outflowBreakdown = await screen.findByTestId(
        "cash-flow-outflow-breakdown",
      );
      expect(
        within(outflowBreakdown).getAllByText("Menu Disposals").length,
      ).toBeGreaterThan(0);
      expect(
        within(outflowBreakdown).getAllByText("Rp 0").length,
      ).toBeGreaterThan(0);
    });
  });
});
