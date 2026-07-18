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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const assetSummary = {
  total_asset_value: 30_000_000,
  asset_count: 3,
  total_quantity: 8,
  profit_daily_avg: 100_000,
  profit_monthly_avg: 3_000_000,
  bep_days: 300,
  bep_months: 10,
  bep_message: null,
  bep_reachable: true,
  profit_source: {
    lookback_days: 30,
    date_from: "2026-06-13T00:00:00Z",
    date_to: "2026-07-13T00:00:00Z",
    net_amount_total: 15_000_000,
  },
};

describe("BranchAssetsSummarySection", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: assetSummary }),
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

  it("3. BEP stat cards are not shown on branch assets summary", async () => {
    render(<BranchAssetsSummarySection />);

    await screen.findByTestId("total-asset-value-card");
    expect(screen.queryByTestId("bep-days-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bep-months-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("branch-assets-bep-section")).not.toBeInTheDocument();
    expect(screen.queryByText("Projected break-even")).not.toBeInTheDocument();
  });

  it("4. Links to the dedicated BEP projection page", async () => {
    render(<BranchAssetsSummarySection />);

    const link = await screen.findByTestId("branch-assets-bep-link");
    expect(link).toHaveAttribute("href", "/admin/cash-flow/bep");
    expect(link).toHaveTextContent("View BEP projection");
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
