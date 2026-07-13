import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
    },
  ],
  inflow_by_method: [
    { method: "CASH", total_amount: 1_000_000, count: 7 },
    { method: "QRIS", total_amount: 500_000, count: 3 },
  ],
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

    expect(await screen.findByText("Total inflow")).toBeInTheDocument();
    expect(screen.getByText("Total outflow")).toBeInTheDocument();
    expect(screen.getByText("Net cash flow")).toBeInTheDocument();
    expect(screen.getByText("Rp 1.500.000")).toBeInTheDocument();
    expect(screen.getAllByText("Rp 500.000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rp 1.000.000").length).toBeGreaterThan(0);
  });

  it("shows inflow-by-method breakdown with mapped amounts", async () => {
    render(<CashFlowSection />);

    expect(
      await screen.findByTestId("cash-flow-inflow-by-method"),
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

    expect(await screen.findByText("Total inflow")).toBeInTheDocument();
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
});
