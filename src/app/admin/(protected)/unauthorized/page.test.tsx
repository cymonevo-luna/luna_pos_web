import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AdminUnauthorizedPage from "./page";
import { useAuth } from "@/lib/auth/context";
import { usersApi } from "@/lib/api/users";
import * as roles from "@/lib/auth/roles";
import type { User } from "@/lib/api/types";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(),
  useRouter: () => ({ replace }),
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
    vi.spyOn(roles, "canAccessRoute");
    vi.mocked(usersApi.get).mockResolvedValue({
      data: cashierWithoutMenus,
    } as Awaited<ReturnType<typeof usersApi.get>>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("does not show contradictory deny messaging when the required feature is already in session", () => {
    mockSearchParams({
      from: "/admin/menus",
      feature: "menus.manage",
      label: "Menu",
    });
    mockAuthUser(cashierWithMenus);

    render(<AdminUnauthorizedPage />);

    expect(
      screen.queryByText(/This privilege is not in your current session/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Your session was out of sync/i),
    ).toBeInTheDocument();

    const privilegesSection = screen
      .getByText("Your current privileges")
      .closest("section");
    expect(privilegesSection).toHaveTextContent("menus.manage");
  });

  it("recovers to the attempted path when the session already includes the required feature", async () => {
    mockSearchParams({
      from: "/admin/menus",
      feature: "menus.manage",
      label: "Menu",
    });
    mockAuthUser(cashierWithMenus);
    vi.mocked(roles.canAccessRoute).mockReturnValue(true);

    render(<AdminUnauthorizedPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenCalledWith("/admin/menus");
    });

    const continueLink = screen.getByRole("link", { name: /Continue to page/i });
    expect(continueLink).toHaveAttribute("href", "/admin/menus");
  });

  it("keeps genuine deny messaging when the required feature is absent from session", () => {
    mockSearchParams({
      from: "/admin/menus",
      feature: "menus.manage",
      label: "Menu",
    });
    mockAuthUser({
      ...cashierWithoutMenus,
      features: ["pos.menu", "pos.transactions"],
    });

    render(<AdminUnauthorizedPage />);

    expect(
      screen.getByText(/This privilege is not in your current session/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /This page requires a privilege that is not in your current session/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Your session was out of sync/i),
    ).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects at most once per mount when recovery is allowed", async () => {
    mockSearchParams({
      from: "/admin/menus",
      feature: "menus.manage",
      label: "Menu",
    });
    mockAuthUser(cashierWithMenus);
    vi.mocked(roles.canAccessRoute).mockReturnValue(true);

    const { rerender } = render(<AdminUnauthorizedPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenCalledWith("/admin/menus");
    });

    rerender(<AdminUnauthorizedPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledTimes(1);
    });
  });
});
