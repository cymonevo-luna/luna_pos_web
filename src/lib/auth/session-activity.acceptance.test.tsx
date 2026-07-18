import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { api } from "@/lib/api/client";
import { AuthProvider, useAuth } from "@/lib/auth/context";
import { refreshTokenPair, resetRefreshInFlightForTests } from "@/lib/auth/refresh";
import { clearAuthSession } from "@/lib/auth/session-store";
import { tokenStore } from "@/lib/auth/tokens";
import { config } from "@/lib/config";
import { SessionActivityMonitor } from "@/components/auth/session-activity-monitor";
import type { LoginPayload } from "@/lib/api/auth";
import { usersApi } from "@/lib/api/users";

vi.mock("@/lib/api/users", () => ({
  usersApi: {
    get: vi.fn(),
  },
}));

vi.mock("@/lib/auth/refresh", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./refresh")>();
  return {
    ...actual,
    refreshTokenPair: vi.fn(),
  };
});

vi.mock("@/lib/api/auth", () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
  },
  MERCHANT_REQUIRED_CODE: "merchant_required",
  isMerchantRequiredError: vi.fn(),
}));

import { authApi } from "@/lib/api/auth";

function makeJwt(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function setPathname(path: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, pathname: path, href: path },
  });
}

/**
 * POS-48-3 checklist coverage for automatic token refresh.
 */
describe("POS-48-3 automatic session refresh", () => {
  const futureExp = Math.floor(Date.now() / 1000) + 3600;

  beforeEach(() => {
    clearAuthSession();
    localStorage.clear();
    resetRefreshInFlightForTests();
    vi.mocked(refreshTokenPair).mockReset();
    vi.mocked(usersApi.get).mockReset();
    vi.mocked(usersApi.get).mockResolvedValue({
      data: {
        id: "user-1",
        email: "admin-test@cymonevo.com",
        name: "Admin Test",
        roles: ["admin"],
        features: ["users.manage"],
        merchant_id: "merchant-1",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    });
    setPathname("/admin");
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      pathname: "/admin",
      href: "/admin",
    } as Location);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dashboard survives access token expiry during active use", async () => {
    tokenStore.set("expired-access", "refresh-1", {
      expires_in: -60,
      refresh_expires_in: 604800,
    });
    vi.mocked(refreshTokenPair).mockResolvedValue({
      tokens: {
        access_token: "fresh-access",
        refresh_token: "fresh-refresh",
        expires_in: 900,
        refresh_expires_in: 604800,
      },
    });

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ success: true, data: { ok: true } }));

    const res = await api.get<{ ok: boolean }>("/api/v1/users/me");

    expect(res.data.ok).toBe(true);
    expect(refreshTokenPair).toHaveBeenCalledWith("refresh-1");
    expect(tokenStore.access).toBe("fresh-access");
    expect(fetchMock.mock.calls[0][1]?.headers).toBeTruthy();
  });

  it("401 triggers silent refresh and retry", async () => {
    tokenStore.set("bad-access", "refresh-1", {
      expires_in: 3600,
      refresh_expires_in: 604800,
    });
    vi.mocked(refreshTokenPair).mockResolvedValue({
      tokens: {
        access_token: "fresh-access",
        refresh_token: "fresh-refresh",
        expires_in: 900,
        refresh_expires_in: 604800,
      },
    });

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ success: false }, 401))
      .mockResolvedValue(jsonResponse({ success: true, data: { ok: true } }));

    const res = await api.get<{ ok: boolean }>("/api/v1/users/me");

    expect(res.data.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refreshTokenPair).toHaveBeenCalledTimes(1);
    expect(tokenStore.access).toBe("fresh-access");
  });

  it("user activity extends session across days (simulated)", async () => {
    const now = Date.now();
    const access = makeJwt({
      uid: "user-1",
      email: "admin-test@cymonevo.com",
      roles: ["admin"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });
    tokenStore.setFromPair({
      access_token: access,
      refresh_token: "refresh-1",
      expires_in: 3600,
      refresh_expires_in: 2 * 24 * 60 * 60,
    });
    localStorage.setItem(
      config.session.user,
      JSON.stringify({
        id: "user-1",
        email: "admin-test@cymonevo.com",
        name: "Admin Test",
        roles: ["admin"],
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
    });

    function SessionProbe() {
      const { isAuthenticated } = useAuth();
      return <span data-testid="authenticated">{String(isAuthenticated)}</span>;
    }

    const { getByTestId } = render(
      <AuthProvider>
        <SessionActivityMonitor />
        <SessionProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(getByTestId("authenticated").textContent).toBe("true");
    });

    window.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await waitFor(() => {
      expect(refreshTokenPair).toHaveBeenCalled();
    });

    const refreshExpiresAt = tokenStore.refreshExpiresAt;
    expect(refreshExpiresAt).not.toBeNull();
    expect(refreshExpiresAt! - now).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
  });

  it("seven-day idle requires re-login", async () => {
    tokenStore.set("access-1", "refresh-1", {
      expires_in: -60,
      refresh_expires_in: -60,
    });
    const hrefSetter = vi.fn();
    let currentHref = "/admin";
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        pathname: "/admin",
        set href(value: string) {
          hrefSetter(value);
          currentHref = value;
        },
        get href() {
          return currentHref;
        },
      },
    });

    await api.get("/api/v1/users/me").catch(() => undefined);

    expect(tokenStore.access).toBeNull();
    expect(tokenStore.refresh).toBeNull();
    expect(hrefSetter).toHaveBeenCalledWith("/admin/login");
    expect(refreshTokenPair).not.toHaveBeenCalled();
  });

  it("login flow regression stores tokens without interceptor refresh", async () => {
    setPathname("/admin/login");
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      pathname: "/admin/login",
      href: "/admin/login",
    } as Location);

    const access = makeJwt({
      uid: "user-1",
      email: "admin-test@cymonevo.com",
      roles: ["admin"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });

    vi.mocked(authApi.login).mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "admin-test@cymonevo.com",
          name: "Admin Test",
          roles: ["admin"],
          merchant_id: "merchant-1",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        merchant: { id: "merchant-1", name: "Test Merchant" },
        tokens: {
          access_token: access,
          refresh_token: "refresh-token",
          expires_in: 900,
          refresh_expires_in: 604800,
        },
      },
      meta: undefined,
    });

    function LoginProbe() {
      const { login } = useAuth();
      return (
        <button
          type="button"
          onClick={() =>
            login({
              email: "admin-test@cymonevo.com",
              password: "LunaTesting123!",
            } as LoginPayload)
          }
        >
          Sign in
        </button>
      );
    }

    const { getByRole } = render(
      <AuthProvider>
        <LoginProbe />
      </AuthProvider>,
    );

    getByRole("button", { name: "Sign in" }).click();

    await waitFor(() => {
      expect(tokenStore.access).toBe(access);
      expect(tokenStore.refresh).toBe("refresh-token");
    });
    expect(refreshTokenPair).not.toHaveBeenCalled();
  });
});
