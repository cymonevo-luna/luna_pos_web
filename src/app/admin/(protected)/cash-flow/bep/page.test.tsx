import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminCashFlowBepPage from "./page";
import { formatBEPHistoricalSubtitle } from "@/lib/api/insights";
import { formatRupiah } from "@/lib/utils";
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

function profitableHistorical(profitLookbackDays: number) {
  const isExtendedLookback = profitLookbackDays >= 60;
  return {
    profit_daily_avg: isExtendedLookback ? 200_000 : 100_000,
    profit_monthly_avg: isExtendedLookback ? 6_000_000 : 3_000_000,
    net_amount_total: 15_000_000,
    lookback_days: profitLookbackDays,
    date_from: "2026-06-13T00:00:00Z",
    date_to: "2026-07-13T00:00:00Z",
  };
}

function buildProjectionPayload({
  profitLookbackDays = 30,
  projectionDays = 90,
  reachable = true,
}: {
  profitLookbackDays?: number;
  projectionDays?: number;
  reachable?: boolean;
} = {}) {
  const historical = profitableHistorical(profitLookbackDays);
  return {
    total_asset_value: 30_000_000,
    asset_count: 3,
    historical,
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
          recurring_expense_id: `rec-${projectionDays}`,
          title: projectionDays === 60 ? "Insurance" : "Rent",
          amount: projectionDays === 60 ? 2_000_000 : 5_000_000,
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

  it("BEP filters show descriptive labels", async () => {
    render(<AdminCashFlowBepPage />);

    expect(await screen.findByTestId("cash-flow-bep-page")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Historical profit lookback"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Forward projection window"),
    ).toBeInTheDocument();
    expect(screen.getByText("Historical profit lookback")).toBeInTheDocument();
    expect(screen.getByText("Forward projection window")).toBeInTheDocument();
  });

  it("BEP page default load regression", async () => {
    render(<AdminCashFlowBepPage />);

    expect(await screen.findByTestId("cash-flow-bep-page")).toBeInTheDocument();
    expect(screen.getByTestId("bep-days-card")).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.getByTestId("bep-months-card")).toHaveTextContent("10");
    expect(screen.getByTestId("bep-comparison-chart")).toBeInTheDocument();

    const chart = await screen.findByTestId("bep-projection-chart");
    expect(chart).toHaveAttribute("data-point-count", "90");
    expect(screen.getByText("Rent")).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("Profit lookback refetch updates historical stat cards", async () => {
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
            }),
          }),
        );
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    render(<AdminCashFlowBepPage />);

    const defaultHistorical = profitableHistorical(30);
    expect(
      await screen.findByText(formatBEPHistoricalSubtitle(defaultHistorical)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(formatRupiah(defaultHistorical.profit_daily_avg)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(formatRupiah(defaultHistorical.profit_monthly_avg)),
    ).toBeInTheDocument();

    await user.selectOptions(
      screen.getByTestId("bep-profit-lookback-select"),
      "60",
    );

    const extendedHistorical = profitableHistorical(60);
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([input]) => String(input));
      expect(
        urls.some((url) => url.includes("profit_lookback_days=60")),
      ).toBe(true);
    });
    expect(
      await screen.findByText(formatRupiah(extendedHistorical.profit_daily_avg)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(formatRupiah(extendedHistorical.profit_monthly_avg)),
    ).toBeInTheDocument();
    expect(screen.queryByText("NaN")).not.toBeInTheDocument();
    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
  });

  it("Projection window refetch updates chart and recurring expenses", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/api/admin/insights/bep/projection")) {
        const parsed = new URL(url);
        const projectionDays = Number(
          parsed.searchParams.get("projection_days") ?? "90",
        );
        return Promise.resolve(
          jsonResponse({
            success: true,
            data: buildProjectionPayload({
              profitLookbackDays: 30,
              projectionDays,
            }),
          }),
        );
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    render(<AdminCashFlowBepPage />);

    const chart = await screen.findByTestId("bep-projection-chart");
    expect(chart).toHaveAttribute("data-point-count", "90");
    expect(screen.getByText("Rent")).toBeInTheDocument();

    await user.selectOptions(
      screen.getByTestId("bep-projection-days-select"),
      "60",
    );

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([input]) => String(input));
      expect(urls.some((url) => url.includes("projection_days=60"))).toBe(
        true,
      );
    });

    const updatedChart = await screen.findByTestId("bep-projection-chart");
    expect(updatedChart).toHaveAttribute("data-point-count", "60");
    expect(screen.getByText("Insurance")).toBeInTheDocument();
    expect(screen.queryByText("Rent")).not.toBeInTheDocument();
    expect(
      screen.getByText(/over the next 60 days/i),
    ).toBeInTheDocument();
  });

  it("BEP unreachable state shows API message without NaN", async () => {
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
