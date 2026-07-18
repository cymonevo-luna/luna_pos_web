import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./context";
import { clearAuthSession } from "./session-store";
import { config } from "@/lib/config";
import { tokenStore } from "./tokens";
import { usersApi } from "@/lib/api/users";
import { refreshTokenPair } from "@/lib/auth/refresh";
import { performSessionRefresh } from "@/lib/auth/session-refresh";
import { canAccessRoute } from "@/lib/auth/roles";
import { filterAdminNavItems, allNavItems } from "@/app/admin/(protected)/layout";
import { isNavGroup } from "@/components/layout/dashboard-shell";
import type { MerchantRole } from "@/lib/api/types";

vi.mock("@/lib/api/users", () => ({
  usersApi: {
    get: vi.fn(),
  },
}));

vi.mock("@/lib/auth/refresh", () => ({
  refreshTokenPair: vi.fn(),
}));

function makeJwt(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

function AuthProbe() {
  const { isLoading, isAuthenticated, user } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="features">{JSON.stringify(user?.features ?? null)}</span>
      <span data-testid="menus-access">
        {String(canAccessRoute("/admin/menus", user))}
      </span>
    </div>
  );
}

/**
 * POS-109-1 checklist coverage for refreshed privilege persistence.
 */
describe("POS-109-1 refreshed privileges in dashboard auth session", () => {
  const futureExp = Math.floor(Date.now() / 1000) + 3600;

  beforeEach(() => {
    clearAuthSession();
    localStorage.clear();
    vi.mocked(refreshTokenPair).mockReset();
    vi.mocked(usersApi.get).mockReset();
  });

  it("refresh response updates cached features", async () => {
    tokenStore.set("old-access", "refresh-1", {
      expires_in: -60,
      refresh_expires_in: 604800,
    });
    localStorage.setItem(
      config.session.user,
      JSON.stringify({
        id: "cashier-1",
        email: "cashier-test@cymonevo.com",
        name: "Cashier",
        roles: ["cashier"],
        features: [],
        merchant_id: "merchant-1",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      }),
    );
    localStorage.setItem(
      config.session.merchant,
      JSON.stringify({ id: "merchant-1", name: "Test Merchant" }),
    );

    vi.mocked(refreshTokenPair).mockResolvedValue({
      tokens: {
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 900,
        refresh_expires_in: 604800,
      },
      features: ["menus.manage"],
    });

    expect(await performSessionRefresh()).toBe(true);

    const stored = JSON.parse(localStorage.getItem(config.session.user) ?? "{}");
    expect(stored.features).toEqual(["menus.manage"]);
  });

  it("menu page loads after grant and refresh", async () => {
    const pastExp = Math.floor(Date.now() / 1000) - 60;
    const expiredAccess = makeJwt({
      uid: "cashier-1",
      email: "cashier-test@cymonevo.com",
      roles: ["cashier"],
      merchant_id: "merchant-1",
      exp: pastExp,
    });
    const newAccess = makeJwt({
      uid: "cashier-1",
      email: "cashier-test@cymonevo.com",
      roles: ["cashier"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });

    tokenStore.set(expiredAccess, "refresh-1", {
      expires_in: -60,
      refresh_expires_in: 604800,
    });
    localStorage.setItem(
      config.session.user,
      JSON.stringify({
        id: "cashier-1",
        email: "cashier-test@cymonevo.com",
        name: "Cashier",
        roles: ["cashier"],
        features: [],
        merchant_id: "merchant-1",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      }),
    );
    localStorage.setItem(
      config.session.merchant,
      JSON.stringify({ id: "merchant-1", name: "Test Merchant" }),
    );

    vi.mocked(refreshTokenPair).mockResolvedValue({
      tokens: {
        access_token: newAccess,
        refresh_token: "new-refresh",
        expires_in: 900,
        refresh_expires_in: 604800,
      },
      features: ["menus.manage"],
    });

    const { getByTestId } = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(getByTestId("loading").textContent).toBe("false");
    });

    expect(getByTestId("menus-access").textContent).toBe("true");
    expect(getByTestId("features").textContent).toBe('["menus.manage"]');
  });

  it("menu page loads after hard reload", async () => {
    const access = makeJwt({
      uid: "cashier-1",
      email: "cashier-test@cymonevo.com",
      roles: ["cashier"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });
    tokenStore.setFromPair({
      access_token: access,
      refresh_token: "refresh-token",
      expires_in: 3600,
      refresh_expires_in: 604800,
    });
    localStorage.setItem(
      config.session.user,
      JSON.stringify({
        id: "cashier-1",
        email: "cashier-test@cymonevo.com",
        name: "Cashier",
        roles: ["cashier"],
        features: [],
        merchant_id: "merchant-1",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      }),
    );
    localStorage.setItem(
      config.session.merchant,
      JSON.stringify({ id: "merchant-1", name: "Test Merchant" }),
    );

    vi.mocked(usersApi.get).mockResolvedValue({
      data: {
        id: "cashier-1",
        email: "cashier-test@cymonevo.com",
        name: "Cashier",
        roles: ["cashier"],
        features: ["menus.manage"],
        merchant_id: "merchant-1",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    });

    const { getByTestId } = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(getByTestId("menus-access").textContent).toBe("true");
    });
    expect(usersApi.get).toHaveBeenCalledWith("cashier-1");
  });

  it("cashier without menus.manage remains blocked", async () => {
    const cashier = {
      roles: ["cashier"] as MerchantRole[],
      features: [] as string[],
    };

    expect(canAccessRoute("/admin/menus", cashier)).toBe(false);

    const filtered = filterAdminNavItems(allNavItems, cashier);
    const foodGroup = filtered.find(
      (entry) => isNavGroup(entry) && entry.label === "Food",
    );
    if (foodGroup && isNavGroup(foodGroup)) {
      expect(foodGroup.children.some((child) => child.href === "/admin/menus")).toBe(
        false,
      );
    } else {
      expect(foodGroup).toBeUndefined();
    }
  });
});
