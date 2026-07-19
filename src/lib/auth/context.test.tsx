import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./context";
import { clearAuthSession } from "./session-store";
import { tokenStore } from "./tokens";
import { usersApi } from "@/lib/api/users";
import { refreshTokenPair } from "@/lib/auth/refresh";

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
      <span data-testid="user">{user?.email ?? ""}</span>
    </div>
  );
}

describe("AuthProvider session restore", () => {
  const futureExp = Math.floor(Date.now() / 1000) + 3600;

  beforeEach(() => {
    clearAuthSession();
    localStorage.clear();
    vi.mocked(refreshTokenPair).mockReset();
    vi.mocked(usersApi.get).mockReset();
  });

  it("restores session from persisted tokens without calling refresh", async () => {
    const access = makeJwt({
      uid: "user-1",
      email: "admin@example.com",
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
      "nt_user",
      JSON.stringify({
        id: "user-1",
        email: "admin@example.com",
        name: "Admin",
        roles: ["admin"],
        merchant_id: "merchant-1",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      }),
    );
    localStorage.setItem(
      "nt_merchant",
      JSON.stringify({ id: "merchant-1", name: "Luna Cafe" }),
    );
    vi.mocked(usersApi.get).mockResolvedValue({
      data: {
        id: "user-1",
        email: "admin@example.com",
        name: "Admin",
        roles: ["admin"],
        features: ["users.manage"],
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
      expect(getByTestId("loading").textContent).toBe("false");
    });
    expect(getByTestId("authenticated").textContent).toBe("true");
    expect(getByTestId("user").textContent).toBe("admin@example.com");
    expect(refreshTokenPair).not.toHaveBeenCalled();
  });

  it("skips usersApi.get on hydrate when stored user already has features", async () => {
    const access = makeJwt({
      uid: "user-1",
      email: "admin@example.com",
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
      "nt_user",
      JSON.stringify({
        id: "user-1",
        email: "admin@example.com",
        name: "Admin",
        roles: ["admin"],
        features: ["users.manage"],
        merchant_id: "merchant-1",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      }),
    );
    localStorage.setItem(
      "nt_merchant",
      JSON.stringify({ id: "merchant-1", name: "Luna Cafe" }),
    );

    const { getByTestId } = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(getByTestId("loading").textContent).toBe("false");
    });
    expect(getByTestId("authenticated").textContent).toBe("true");
    expect(usersApi.get).not.toHaveBeenCalled();
  });

  it("silently refreshes when access is expired but refresh is valid", async () => {
    const pastExp = Math.floor(Date.now() / 1000) - 60;
    const expiredAccess = makeJwt({
      uid: "user-1",
      email: "admin@example.com",
      roles: ["admin"],
      merchant_id: "merchant-1",
      exp: pastExp,
    });
    const newAccess = makeJwt({
      uid: "user-1",
      email: "admin@example.com",
      roles: ["admin"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });

    tokenStore.set(expiredAccess, "refresh-token", {
      expires_in: -60,
      refresh_expires_in: 604800,
    });

    vi.mocked(refreshTokenPair).mockResolvedValue({
      tokens: {
        access_token: newAccess,
        refresh_token: "refresh-token-2",
        expires_in: 3600,
        refresh_expires_in: 604800,
      },
    });
    vi.mocked(usersApi.get).mockResolvedValue({
      data: {
        id: "user-1",
        email: "admin@example.com",
        name: "Admin",
        roles: ["admin"],
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
      expect(getByTestId("authenticated").textContent).toBe("true");
    });
    expect(refreshTokenPair).toHaveBeenCalledWith("refresh-token");
    expect(tokenStore.access).toBe(newAccess);
  });

  it("clears storage when refresh token expiry is in the past", async () => {
    tokenStore.set("access-token", "refresh-token", {
      expires_in: -60,
      refresh_expires_in: -60,
    });
    localStorage.setItem(
      "nt_user",
      JSON.stringify({
        id: "user-1",
        email: "admin@example.com",
        name: "Admin",
        roles: ["admin"],
        merchant_id: "merchant-1",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      }),
    );

    const { getByTestId } = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(getByTestId("loading").textContent).toBe("false");
    });
    expect(getByTestId("authenticated").textContent).toBe("false");
    expect(tokenStore.access).toBeNull();
    expect(localStorage.getItem("nt_user")).toBeNull();
    expect(refreshTokenPair).not.toHaveBeenCalled();
  });
});
