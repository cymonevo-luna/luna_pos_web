import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminCashFlowPage from "./page";

vi.mock("@/components/admin/cash-flow-section", () => ({
  CashFlowSection: () => <div data-testid="cash-flow-section">Cash flow</div>,
}));

vi.mock("@/components/admin/transaction-menu-pie-chart", () => ({
  TransactionMenuPieChart: () => (
    <div data-testid="transaction-menu-insights">Menu insights</div>
  ),
}));

vi.mock("@/components/admin/production-insight-panel", () => ({
  ProductionInsightPanel: () => (
    <div data-testid="production-insight-panel">Production insight</div>
  ),
}));

describe("AdminCashFlowPage", () => {
  it("renders all three sections", () => {
    render(<AdminCashFlowPage />);

    expect(screen.getByTestId("cash-flow-page")).toBeInTheDocument();
    expect(screen.getByTestId("cash-flow-section")).toBeInTheDocument();
    expect(screen.getByTestId("transaction-menu-insights")).toBeInTheDocument();
    expect(screen.getByTestId("production-insight-panel")).toBeInTheDocument();
  });
});
