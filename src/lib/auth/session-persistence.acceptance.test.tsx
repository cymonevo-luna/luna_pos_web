import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./context";
import { clearAuthSession } from "./session-store";
import { tokenStore } from "./tokens";
import { config } from "@/lib/config";
import { refreshTokenPair } from "@/lib/auth/refresh";
import { usersApi } from "@/lib/api/users";

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

function SessionProbe() {
  const { isLoading, isAuthenticated } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
    </div>
  );
}

/**
 * POS-48-2 checklist coverage for dashboard session persistence.
 * Mirrors manual QA steps using localStorage + AuthProvider bootstrap.
 */
describe("POS-48-2 dashboard session persistence", () => {
  const futureExp = Math.floor(Date.now() / 1000) + 3600;

  beforeEach(() => {
    clearAuthSession();
    localStorage.clear();
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
  });

  it("dashboard stays logged in after tab close (persisted tokens restore on load)", async () => {
    const access = makeJwt({
      uid: "user-1",
      email: "admin-test@cymonevo.com",
      roles: ["admin"],
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

    const { getByTestId, unmount } = render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(getByTestId("authenticated").textContent).toBe("true");
    });

    unmount();

    const { getByTestId: getByTestIdAfterReopen } = render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(getByTestIdAfterReopen("authenticated").textContent).toBe("true");
    });
    expect(refreshTokenPair).not.toHaveBeenCalled();
  });

  it("dashboard stays logged in after browser refresh", async () => {
    const access = makeJwt({
      uid: "user-1",
      email: "admin-test@cymonevo.com",
      roles: ["admin"],
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

    const first = render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(first.getByTestId("authenticated").textContent).toBe("true");
    });
    first.unmount();

    const second = render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(second.getByTestId("authenticated").textContent).toBe("true");
    });
  });

  it("explicit logout clears persisted session", async () => {
    const access = makeJwt({
      uid: "user-1",
      email: "admin-test@cymonevo.com",
      roles: ["admin"],
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

    function LogoutProbe() {
      const auth = useAuth();
      return (
        <button type="button" onClick={() => auth.logout()}>
          Logout
        </button>
      );
    }

    const { getByRole } = render(
      <AuthProvider>
        <LogoutProbe />
      </AuthProvider>,
    );
    getByRole("button", { name: "Logout" }).click();

    expect(localStorage.getItem(config.tokens.accessToken)).toBeNull();
    expect(localStorage.getItem(config.tokens.refreshToken)).toBeNull();
    expect(localStorage.getItem(config.tokens.accessExpiresAt)).toBeNull();
    expect(localStorage.getItem(config.tokens.refreshExpiresAt)).toBeNull();
    expect(localStorage.getItem(config.session.user)).toBeNull();
    expect(localStorage.getItem(config.session.merchant)).toBeNull();
  });

  it("expired refresh token shows login on load and clears storage", async () => {
    tokenStore.set("access-token", "refresh-token", {
      expires_in: -60,
      refresh_expires_in: -60,
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

    const { getByTestId } = render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(getByTestId("loading").textContent).toBe("false");
    });
    expect(getByTestId("authenticated").textContent).toBe("false");
    expect(localStorage.getItem(config.tokens.accessToken)).toBeNull();
    expect(localStorage.getItem(config.tokens.refreshToken)).toBeNull();
    expect(localStorage.getItem(config.session.user)).toBeNull();
    expect(refreshTokenPair).not.toHaveBeenCalled();
  });
});
