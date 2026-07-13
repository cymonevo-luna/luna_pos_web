import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CashFlowSection } from "./cash-flow-section";
import { cashFlowSummary } from "@/lib/api/insights";
import { ApiError } from "@/lib/api/client";
import type { CashFlowSummary } from "@/lib/api/types";
import { toast } from "sonner";

vi.mock("@/lib/api/insights", () => ({
  cashFlowSummary: vi.fn(),
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

const sampleSummary: CashFlowSummary = {
  period: "daily",
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
    { method: "CASH", amount: 1_000_000, count: 7 },
    { method: "QRIS", amount: 500_000, count: 3 },
  ],
};

describe("CashFlowSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cashFlowSummary).mockResolvedValue({ data: sampleSummary });
  });

  it("renders formatted currency stat cards", async () => {
    render(<CashFlowSection />);

    expect(await screen.findByText("Total inflow")).toBeInTheDocument();
    expect(screen.getByText("Total outflow")).toBeInTheDocument();
    expect(screen.getByText("Net cash flow")).toBeInTheDocument();
    expect(screen.getByText("Rp 1.500.000")).toBeInTheDocument();
    expect(screen.getAllByText("Rp 500.000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rp 1.000.000").length).toBeGreaterThan(0);
  });

  it("shows inflow-by-method breakdown", async () => {
    render(<CashFlowSection />);

    expect(
      await screen.findByTestId("cash-flow-inflow-by-method"),
    ).toBeInTheDocument();
    expect(screen.getByText("CASH")).toBeInTheDocument();
    expect(screen.getByText("QRIS")).toBeInTheDocument();
  });

  it("refetches when date range changes", async () => {
    const user = userEvent.setup();
    render(<CashFlowSection />);
    await screen.findByText("Rp 1.500.000");

    await user.clear(screen.getByLabelText("Cash flow date from"));
    await user.type(screen.getByLabelText("Cash flow date from"), "2026-01-01");

    await waitFor(() => {
      expect(cashFlowSummary).toHaveBeenLastCalledWith(
        expect.objectContaining({ dateFrom: "2026-01-01" }),
      );
    });
  });

  it("shows error toast when loading fails", async () => {
    vi.mocked(cashFlowSummary).mockRejectedValue(
      new ApiError(500, "server_error", "Server error"),
    );

    render(<CashFlowSection />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Server error");
    });
  });
});
