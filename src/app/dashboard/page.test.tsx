import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import DashboardHomePage from "./page";
import { transactionsPosApi } from "@/lib/api/pos-transactions";
import { formatRupiah } from "@/lib/utils";
import type { User } from "@/lib/api/types";

vi.mock("@/lib/api/pos-transactions", () => ({
  transactionsPosApi: {
    summary: vi.fn(),
  },
}));

const mockUseAuth = vi.fn();
const mockUseRoles = vi.fn();

vi.mock("@/lib/auth/context", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/lib/auth/use-roles", () => ({
  useRoles: () => mockUseRoles(),
}));

function cashierOnlyUser(): User {
  return {
    id: "cashier-1",
    name: "Cashier Test",
    email: "cashier-test@cymonevo.com",
    roles: ["cashier"],
    merchant_id: "merchant-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function managerUser(): User {
  return {
    id: "manager-1",
    name: "Manager Test",
    email: "manager-test@cymonevo.com",
    roles: ["manager"],
    merchant_id: "merchant-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function mockCashierAuth() {
  const user = cashierOnlyUser();
  mockUseAuth.mockReturnValue({
    user,
    isAdmin: false,
  });
  mockUseRoles.mockReturnValue({
    roles: user.roles,
    hasRole: (role: string) => role === "cashier",
    hasAnyRole: (roles: string[]) =>
      roles.some((role) => user.roles.includes(role as never)),
  });
}

function mockManagerAuth() {
  const user = managerUser();
  mockUseAuth.mockReturnValue({
    user,
    isAdmin: true,
  });
  mockUseRoles.mockReturnValue({
    roles: user.roles,
    hasRole: (role: string) => role === "manager",
    hasAnyRole: (roles: string[]) =>
      roles.some((role) => user.roles.includes(role as never)),
  });
}

describe("DashboardHomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(transactionsPosApi.summary).mockResolvedValue({
      data: {
        period: "daily",
        buckets: [
          {
            period_start: "2026-07-12T00:00:00Z",
            period_label: "Jul 12",
            count: 3,
            total_amount: 150_000,
          },
        ],
      },
    });
  });

  it("removes template placeholders for cashier-only users", async () => {
    mockCashierAuth();
    render(<DashboardHomePage />);

    await waitFor(() => {
      expect(screen.getByText("Today's revenue")).toBeInTheDocument();
    });

    expect(screen.queryByText("Total Tasks")).not.toBeInTheDocument();
    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
    expect(screen.queryByText("In Progress")).not.toBeInTheDocument();
    expect(screen.queryByText("Design Review")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Activity")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Create new")).not.toBeInTheDocument();
  });

  it("shows mobile app guidance for cashier-only users", async () => {
    mockCashierAuth();
    render(<DashboardHomePage />);

    expect(
      await screen.findByText("POS mobile app"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Cashier accounts use the Luna POS mobile app/i),
    ).toBeInTheDocument();
  });

  it("loads POS summary stats for cashier users", async () => {
    mockCashierAuth();
    render(<DashboardHomePage />);

    expect(await screen.findByText("Today's revenue")).toBeInTheDocument();
    expect(screen.getByText(formatRupiah(150_000))).toBeInTheDocument();
    expect(screen.getByText("Today's transactions")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(transactionsPosApi.summary).toHaveBeenCalledWith(
      expect.objectContaining({ period: "daily" }),
    );
  });

  it("shows link to admin POS dashboard for merchant users", async () => {
    mockManagerAuth();
    render(<DashboardHomePage />);

    const link = await screen.findByRole("link", {
      name: /Open POS Dashboard/i,
    });
    expect(link).toHaveAttribute("href", "/admin");
  });
});
