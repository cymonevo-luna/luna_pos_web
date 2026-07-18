import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminOverviewPage from "./page";
import { useAuth } from "@/lib/auth/context";
import type { User } from "@/lib/api/types";
import { featuresForRoles } from "@/lib/auth/feature-fixtures";

vi.mock("@/lib/auth/context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/components/dashboard/greeting-card", () => ({
  GreetingCard: ({ name, message }: { name: string; message?: string }) => (
    <div data-testid="greeting-card">
      <span>{name}</span>
      {message ? <span>{message}</span> : null}
    </div>
  ),
}));

vi.mock("@/components/dashboard/dashboard-summary-stats", () => ({
  DashboardSummaryStats: ({ features }: { features: string[] }) => (
    <div data-testid="dashboard-summary-stats">{features.join(",")}</div>
  ),
}));

vi.mock("@/components/dashboard/cash-flow-overview-stats", () => ({
  CashFlowOverviewStats: () => (
    <div data-testid="cash-flow-overview-stats">Cash flow overview</div>
  ),
}));

vi.mock("@/components/admin/transaction-summary-chart", () => ({
  TransactionSummaryChart: () => (
    <div data-testid="transaction-summary-chart">Transaction volume</div>
  ),
}));

vi.mock("@/components/dashboard/recent-transactions-panel", () => ({
  RecentTransactionsPanel: () => (
    <div data-testid="recent-transactions-panel">Recent transactions</div>
  ),
}));

const TEMPLATE_PLACEHOLDERS = [
  "Total Tasks",
  "Design Review",
  "Project Meeting",
  "Update Documentation",
];

function mockAuthUser(user: User) {
  vi.mocked(useAuth).mockReturnValue({
    user,
    merchant: { id: "merchant-1", name: "Test Merchant" },
    isLoading: false,
    isAuthenticated: true,
    isAdmin: user.roles.includes("admin"),
    login: vi.fn(),
    register: vi.fn(),
    registerMerchant: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  });
}

const managerUser: User = {
  id: "manager-1",
  email: "manager-test@cymonevo.com",
  name: "Manager Test",
  roles: ["manager"],
  features: featuresForRoles(["manager"]),
  merchant_id: "merchant-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

const adminUser: User = {
  id: "admin-1",
  email: "admin-test@cymonevo.com",
  name: "Admin Test",
  roles: ["admin"],
  features: featuresForRoles(["admin"]),
  merchant_id: "merchant-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

const operationalUser: User = {
  id: "operational-1",
  email: "operation-test@cymonevo.com",
  name: "Operational Test",
  roles: ["operational"],
  features: featuresForRoles(["operational"]),
  merchant_id: "merchant-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

describe("AdminOverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("manager admin home renders all dashboard sections", () => {
    mockAuthUser(managerUser);
    const { container } = render(<AdminOverviewPage />);

    expect(screen.getByTestId("greeting-card")).toBeInTheDocument();
    expect(screen.getByText("Welcome to your POS dashboard")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Summary" })).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-summary-stats")).toBeInTheDocument();
    expect(screen.getByTestId("cash-flow-overview-stats")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Analytics" })).toBeInTheDocument();
    expect(screen.getByTestId("transaction-summary-chart")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Quick actions" }),
    ).toBeInTheDocument();
    expect(screen.getByText("User transactions")).toBeInTheDocument();
    expect(screen.getByText("Menu breakdown")).toBeInTheDocument();
    expect(screen.getByText("Menus")).toBeInTheDocument();
    expect(screen.getByTestId("recent-transactions-panel")).toBeInTheDocument();

    for (const placeholder of TEMPLATE_PLACEHOLDERS) {
      expect(container.textContent).not.toContain(placeholder);
    }
  });

  it("admin-only home hides manager analytics", () => {
    mockAuthUser(adminUser);
    render(<AdminOverviewPage />);

    expect(screen.getByRole("heading", { name: "Summary" })).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-summary-stats")).toBeInTheDocument();
    expect(
      screen.queryByTestId("cash-flow-overview-stats"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("User management")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Analytics" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("transaction-summary-chart"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("recent-transactions-panel"),
    ).not.toBeInTheDocument();
  });

  it("operational home shows operational quick actions", () => {
    mockAuthUser(operationalUser);
    render(<AdminOverviewPage />);

    expect(screen.getByText("Suppliers")).toBeInTheDocument();
    expect(screen.getByText("Purchase requests")).toBeInTheDocument();
    expect(
      screen.queryByTestId("cash-flow-overview-stats"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("COGS")).not.toBeInTheDocument();
    expect(screen.queryByText("Transactions")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("transaction-summary-chart"),
    ).not.toBeInTheDocument();
  });

  it("admin home has no template placeholder content", () => {
    mockAuthUser(managerUser);
    const { container } = render(<AdminOverviewPage />);

    for (const placeholder of TEMPLATE_PLACEHOLDERS) {
      expect(container.textContent).not.toContain(placeholder);
    }
  });

  it("manager Transactions quick action links to /admin/transactions", () => {
    mockAuthUser(managerUser);
    render(<AdminOverviewPage />);

    const openLinks = screen.getAllByRole("link", { name: /open/i });
    const transactionsLink = openLinks.find(
      (link) => link.getAttribute("href") === "/admin/transactions",
    );

    expect(transactionsLink).toBeDefined();
    expect(transactionsLink).toHaveAttribute("href", "/admin/transactions");
  });
});
