import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductionInsightPanel } from "./production-insight-panel";
import { productionNextDayInsight } from "@/lib/api/insights";
import type { ProductionNextDayInsight } from "@/lib/api/types";

vi.mock("@/lib/api/insights", () => ({
  productionNextDayInsight: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const sampleInsight: ProductionNextDayInsight = {
  lookback_days: 14,
  generated_at: "2026-07-13T10:00:00.000Z",
  items: [
    {
      menu_id: "menu-1",
      menu_title: "Nasi Goreng",
      current_stock: 5,
      avg_daily_sales: 8,
      projected_demand: 10,
      recommended_production_qty: 5,
      max_producible: 12,
      confidence: "high",
      limited_by_ingredients: false,
    },
    {
      menu_id: "menu-2",
      menu_title: "Mie Goreng",
      current_stock: 20,
      avg_daily_sales: 3,
      projected_demand: 4,
      recommended_production_qty: 0,
      max_producible: 8,
      confidence: "medium",
      limited_by_ingredients: true,
      limiting_ingredient_title: "Flour",
    },
  ],
};

describe("ProductionInsightPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(productionNextDayInsight).mockResolvedValue({
      data: sampleInsight,
    });
  });

  it("renders recommendations and highlights actionable rows", async () => {
    render(<ProductionInsightPanel />);

    expect(await screen.findByText("Nasi Goreng")).toBeInTheDocument();
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
});
