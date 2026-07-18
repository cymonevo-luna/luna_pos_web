import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AdminUnauthorizedPage from "./page";
import { useAuth } from "@/lib/auth/context";
import { usersApi } from "@/lib/api/users";
import type { User } from "@/lib/api/types";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(),
}));

vi.mock("@/lib/auth/context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/api/users", () => ({
  usersApi: {
    get: vi.fn(),
  },
}));

import { useSearchParams } from "next/navigation";

const cashierWithoutMenus: User = {
  id: "cashier-1",
  email: "cashier-test@cymonevo.com",
  name: "Cashier Test",
  roles: ["cashier"],
  features: ["pos.menu", "pos.transactions", "transactions.view"],
  merchant_id: "merchant-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

const cashierWithMenus: User = {
  ...cashierWithoutMenus,
  features: ["pos.menu", "pos.transactions", "menus.manage"],
};

function mockSearchParams(params: Record<string, string>) {
  vi.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams(params) as ReturnType<typeof useSearchParams>,
  );
}

function mockAuthUser(user: User, refreshUser = vi.fn()) {
  vi.mocked(useAuth).mockReturnValue({
    user,
    merchant: { id: "merchant-1", name: "Test Merchant" },
    isLoading: false,
    isAuthenticated: true,
    isAdmin: true,
    login: vi.fn(),
    register: vi.fn(),
    registerMerchant: vi.fn(),
    logout: vi.fn(),
    refreshUser,
  });
}

describe("AdminUnauthorizedPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersApi.get).mockResolvedValue({
      data: cashierWithoutMenus,
    } as Awaited<ReturnType<typeof usersApi.get>>);
  });

  it("shows required menus.manage and attempted route from query params", () => {
    mockSearchParams({
      from: "/admin/menus",
      feature: "menus.manage",
      label: "Menu",
    });
    mockAuthUser(cashierWithoutMenus);

    render(<AdminUnauthorizedPage />);

    expect(screen.getByText("Menu")).toBeInTheDocument();
    expect(screen.getByText("(/admin/menus)")).toBeInTheDocument();
    expect(screen.getByText("menus.manage")).toBeInTheDocument();
    expect(
      screen.getByText(/This privilege is not in your current session/i),
    ).toBeInTheDocument();
  });

  it("lists the user's current features from auth context", () => {
    mockSearchParams({
      from: "/admin/menus",
      feature: "menus.manage",
      label: "Menu",
    });
    mockAuthUser(cashierWithoutMenus);

    render(<AdminUnauthorizedPage />);

    const privilegesSection = screen
      .getByText("Your current privileges")
      .closest("section");
    expect(privilegesSection).not.toBeNull();
    expect(privilegesSection).toHaveTextContent("pos.menu");
    expect(privilegesSection).toHaveTextContent("pos.transactions");
    expect(privilegesSection).toHaveTextContent("transactions.view");
    expect(privilegesSection).not.toHaveTextContent("menus.manage");
  });

  it("shows categories.manage for denied category routes", () => {
    mockSearchParams({
      from: "/admin/categories",
      feature: "categories.manage",
      label: "Categories",
    });
    mockAuthUser(cashierWithoutMenus);

    render(<AdminUnauthorizedPage />);

    expect(screen.getByText("Categories")).toBeInTheDocument();
    expect(screen.getByText("categories.manage")).toBeInTheDocument();
  });

  it("degrades gracefully when query context is missing", () => {
    mockSearchParams({});
    mockAuthUser(cashierWithoutMenus);

    render(<AdminUnauthorizedPage />);

    expect(
      screen.getByText(/You do not have permission to view this page/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Required privilege")).not.toBeInTheDocument();
  });

  it("shows a stale-session hint when a refresh includes the required feature", async () => {
    mockSearchParams({
      from: "/admin/menus",
      feature: "menus.manage",
      label: "Menu",
    });
    mockAuthUser(cashierWithoutMenus);
    vi.mocked(usersApi.get).mockResolvedValue({
      data: cashierWithMenus,
    } as Awaited<ReturnType<typeof usersApi.get>>);

    render(<AdminUnauthorizedPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Your privileges were updated/i),
      ).toBeInTheDocument();
    });
  });
});
