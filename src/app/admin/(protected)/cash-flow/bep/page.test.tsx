import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminCashFlowBepPage from "./page";
import { formatBEPHistoricalSubtitle } from "@/lib/api/insights";
import { tokenStore } from "@/lib/auth/tokens";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
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

const profitableHistorical = {
  profit_daily_avg: 100_000,
  profit_monthly_avg: 3_000_000,
  net_amount_total: 15_000_000,
  lookback_days: 30,
  date_from: "2026-06-13T00:00:00Z",
  date_to: "2026-07-13T00:00:00Z",
};

function buildProjectionPayload({
  profitLookbackDays = 30,
  projectionDays = 90,
  reachable = true,
}: {
  profitLookbackDays?: number;
  projectionDays?: number;
  reachable?: boolean;
} = {}) {
  return {
    total_asset_value: 30_000_000,
    asset_count: 3,
    historical: {
      ...profitableHistorical,
      lookback_days: profitLookbackDays,
    },
    bep: {
      bep_days: reachable ? 300 : null,
      bep_months: reachable ? 10 : null,
      bep_reachable: reachable,
      bep_message: reachable
        ? null
        : "Profit must be positive to calculate break-even.",
    },
    projection: {
      projection_days: projectionDays,
      daily_inflow_avg: 150_000,
      daily_expense_avg: 50_000,
      daily_staff_payout_avg: 0,
      daily_production_cost_avg: 0,
      daily_net_projected: 100_000,
      buckets: Array.from({ length: projectionDays }, (_, day_offset) => ({
        day_offset,
        date: `2026-07-${String((day_offset % 28) + 1).padStart(2, "0")}`,
        projected_inflow: 150_000,
        projected_outflow: 50_000,
        projected_production_cost: 0,
        projected_net: 100_000,
        cumulative_net: 100_000 * (day_offset + 1),
      })),
      upcoming_recurring_expenses: [
        {
          recurring_expense_id: "rec-1",
          title: "Rent",
          amount: 5_000_000,
          next_run_at: "2026-08-01T00:00:00Z",
        },
      ],
    },
    generated_at: "2026-07-13T10:00:00Z",
  };
}

describe("AdminCashFlowBepPage", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/api/admin/insights/bep/projection")) {
        const parsed = new URL(url);
        const profitLookbackDays = Number(
          parsed.searchParams.get("profit_lookback_days") ?? "30",
        );
        const projectionDays = Number(
          parsed.searchParams.get("projection_days") ?? "90",
        );
        return Promise.resolve(
          jsonResponse({
            success: true,
            data: buildProjectionPayload({
              profitLookbackDays,
              projectionDays,
            }),
          }),
        );
      }
      return Promise.reject(new Error(`Unhandled fetch in BEP page test: ${url}`));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. BEP page shows projection chart with stat cards and 90 data points by default", async () => {
    render(<AdminCashFlowBepPage />);

    expect(await screen.findByTestId("cash-flow-bep-page")).toBeInTheDocument();
    expect(screen.getByTestId("bep-days-card")).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.getByTestId("bep-months-card")).toHaveTextContent("10");

    const chart = await screen.findByTestId("bep-projection-chart");
    expect(chart).toHaveAttribute("data-point-count", "90");
    expect(screen.getByText("Rent")).toBeInTheDocument();
  });

  it("2. BEP unreachable state shows API message without NaN", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: buildProjectionPayload({ reachable: false }),
      }),
    );

    render(<AdminCashFlowBepPage />);

    await screen.findByTestId("bep-unreachable-message");
    expect(screen.getAllByText("N/A")).toHaveLength(2);
    expect(screen.getByTestId("bep-unreachable-message")).toHaveTextContent(
      "Profit must be positive to calculate break-even.",
    );
    expect(screen.queryByText("NaN")).not.toBeInTheDocument();
  });

  it("3. Profit lookback selector refetches BEP values", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/api/admin/insights/bep/projection")) {
        const parsed = new URL(url);
        const profitLookbackDays = Number(
          parsed.searchParams.get("profit_lookback_days") ?? "30",
        );
        return Promise.resolve(
          jsonResponse({
            success: true,
            data: buildProjectionPayload({
              profitLookbackDays,
              projectionDays: 90,
              reachable: true,
            }),
          }),
        );
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    render(<AdminCashFlowBepPage />);

    expect(
      await screen.findByText(formatBEPHistoricalSubtitle(profitableHistorical)),
    ).toBeInTheDocument();

    await user.selectOptions(
      screen.getByTestId("bep-profit-lookback-select"),
      "60",
    );

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([input]) => String(input));
      expect(
        urls.some((url) => url.includes("profit_lookback_days=60")),
      ).toBe(true);
    });
  });

  it("shows error toast when loading fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: { code: "server_error", message: "Projection unavailable" },
        },
        500,
      ),
    );

    render(<AdminCashFlowBepPage />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Projection unavailable");
    });
    expect(screen.getByText("Projection unavailable")).toBeInTheDocument();
  });

  it("links back to cash flow overview", async () => {
    render(<AdminCashFlowBepPage />);

    expect(await screen.findByTestId("bep-back-link")).toHaveAttribute(
      "href",
      "/admin/cash-flow",
    );
  });
});
