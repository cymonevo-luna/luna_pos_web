import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductionInsightPanel } from "./production-insight-panel";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const backendPayload = {
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

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ProductionInsightPanel", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: backendPayload }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders recommendations and highlights actionable rows", async () => {
    render(<ProductionInsightPanel />);

    expect(await screen.findByText("Nasi Goreng")).toBeInTheDocument();
    expect(screen.getByText("Mie Goreng")).toBeInTheDocument();
    expect(screen.getAllByText("5").length).toBeGreaterThan(0);
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Limited")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /new production request/i }),
    ).toHaveAttribute("href", "/admin/production-requests/new");
  });

  it("shows generated timestamp", async () => {
    render(<ProductionInsightPanel />);

    expect(await screen.findByText(/Generated/i)).toBeInTheDocument();
  });

  it("handles ingredient-limited rows with capped recommended production", async () => {
    render(<ProductionInsightPanel />);

    expect(await screen.findByText("Mie Goreng")).toBeInTheDocument();
    expect(screen.getByText("Limited")).toBeInTheDocument();
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(2);
  });

  it("renders 0.0 fallback when avg_daily_sales is missing", async () => {
    const payloadWithMissingAvgDailySales = {
      ...backendPayload,
      menus: [
        {
          ...backendPayload.menus[0],
          avg_daily_sales: undefined,
        },
        backendPayload.menus[1],
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: payloadWithMissingAvgDailySales }),
    );

    render(<ProductionInsightPanel />);

    expect(await screen.findByText("Nasi Goreng")).toBeInTheDocument();
    expect(screen.getByText("0.0")).toBeInTheDocument();
    expect(screen.getByText("10.0")).toBeInTheDocument();
  });

  it("renders 0.0 fallback when projected_demand is null", async () => {
    const payloadWithNullProjectedDemand = {
      ...backendPayload,
      menus: [
        {
          ...backendPayload.menus[0],
          projected_demand: null,
        },
        backendPayload.menus[1],
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: payloadWithNullProjectedDemand }),
    );

    render(<ProductionInsightPanel />);

    expect(await screen.findByText("Nasi Goreng")).toBeInTheDocument();
    expect(screen.getByText("0.0")).toBeInTheDocument();
    expect(screen.getByText("8.0")).toBeInTheDocument();
  });
});
