import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BranchAssetsSummarySection } from "./branch-assets-summary-section";
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

const profitableSummary = {
  total_asset_value: 30_000_000,
  asset_count: 3,
  total_quantity: 8,
  profit_daily_avg: 100_000,
  profit_monthly_avg: 3_000_000,
  bep_days: 300,
  bep_months: 10,
  bep_message: null,
  bep_reachable: true,
  profit_source: "Based on net profit over the last 30 days",
};

const noProfitSummary = {
  total_asset_value: 30_000_000,
  asset_count: 2,
  total_quantity: 4,
  profit_daily_avg: 0,
  profit_monthly_avg: 0,
  bep_days: null,
  bep_months: null,
  bep_message: "Insufficient profit data to calculate break-even",
  bep_reachable: false,
  profit_source: "No sales in the last 30 days",
};

describe("BranchAssetsSummarySection", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: profitableSummary }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Summary page loads and shows Total Asset Value card", async () => {
    render(<BranchAssetsSummarySection />);

    expect(await screen.findByTestId("total-asset-value-card")).toBeInTheDocument();
    expect(screen.getByText("Total Asset Value")).toBeInTheDocument();
    expect(screen.getByText("Rp 30.000.000")).toBeInTheDocument();
  });

  it("2. Summary reflects created asset totals", async () => {
    render(<BranchAssetsSummarySection />);

    await screen.findByText("Rp 30.000.000");
    expect(screen.getByText("Asset Count")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Total Quantity")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("3. BEP days and months displayed when profit is positive", async () => {
    render(<BranchAssetsSummarySection />);

    await screen.findByTestId("bep-days-card");
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.getByTestId("bep-months-card")).toHaveTextContent("10");
    expect(screen.queryByText("N/A")).not.toBeInTheDocument();
  });

  it("4. BEP shows N/A without profit", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: noProfitSummary }),
    );

    render(<BranchAssetsSummarySection />);

    await screen.findByTestId("bep-days-card");
    expect(screen.getAllByText("N/A")).toHaveLength(2);
    expect(screen.getByTestId("bep-unreachable-message")).toHaveTextContent(
      "Insufficient profit data to calculate break-even",
    );
  });

  it("5. Refresh reloads summary", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<BranchAssetsSummarySection />);
    await screen.findByText("Rp 30.000.000");

    const initialCalls = fetchMock.mock.calls.length;
    await user.click(screen.getByTestId("branch-assets-summary-refresh"));

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(initialCalls);
    });
    expect(screen.getByTestId("branch-assets-summary-refresh")).toBeInTheDocument();
  });

  it("shows profit source on daily profit card", async () => {
    render(<BranchAssetsSummarySection />);

    expect(
      await screen.findByText("Based on net profit over the last 30 days"),
    ).toBeInTheDocument();
  });

  it("links back to asset list", async () => {
    render(<BranchAssetsSummarySection />);

    expect(await screen.findByTestId("branch-assets-back-link")).toHaveAttribute(
      "href",
      "/admin/branch-assets",
    );
  });

  it("shows error toast when loading fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: { code: "server_error", message: "Summary unavailable" },
        },
        500,
      ),
    );

    render(<BranchAssetsSummarySection />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Summary unavailable");
    });
    expect(screen.getByText("Summary unavailable")).toBeInTheDocument();
  });
});
