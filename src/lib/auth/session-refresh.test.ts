import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ensureFreshAccessToken,
  isAuthExemptApiPath,
  isLoginRoute,
  performSessionRefresh,
} from "./session-refresh";
import { config } from "@/lib/config";
import { tokenStore } from "./tokens";
import { sessionStore } from "./session-store";
import { refreshTokenPair, resetRefreshInFlightForTests } from "./refresh";

vi.mock("@/lib/auth/refresh", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./refresh")>();
  return {
    ...actual,
    refreshTokenPair: vi.fn(),
  };
});

describe("session-refresh", () => {
  beforeEach(() => {
    tokenStore.clear();
    localStorage.clear();
    resetRefreshInFlightForTests();
    vi.mocked(refreshTokenPair).mockReset();
    vi.restoreAllMocks();
  });

  it("isAuthExemptApiPath matches login and refresh endpoints", () => {
    expect(isAuthExemptApiPath("/api/v1/auth/login")).toBe(true);
    expect(isAuthExemptApiPath("/api/v1/auth/refresh")).toBe(true);
    expect(isAuthExemptApiPath("/api/v1/users/me")).toBe(false);
  });

  it("isLoginRoute matches dashboard login pages", () => {
    expect(isLoginRoute("/admin/login")).toBe(true);
    expect(isLoginRoute("/login")).toBe(true);
    expect(isLoginRoute("/admin")).toBe(false);
  });

  it("performSessionRefresh stores a new token pair", async () => {
    tokenStore.set("old-access", "refresh-1", {
      expires_in: -60,
      refresh_expires_in: 604800,
    });
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
    expect(tokenStore.access).toBe("new-access");
    expect(tokenStore.refresh).toBe("new-refresh");
  });

  it("performSessionRefresh merges features into persisted session", async () => {
    tokenStore.set("old-access", "refresh-1", {
      expires_in: -60,
      refresh_expires_in: 604800,
    });
    sessionStore.set({
      user: {
        id: "cashier-1",
        email: "cashier-test@cymonevo.com",
        name: "Cashier",
        roles: ["cashier"],
        features: [],
        merchant_id: "merchant-1",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      merchant: { id: "merchant-1", name: "Test Merchant" },
    });
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

  it("ensureFreshAccessToken skips refresh when access is still fresh", async () => {
    tokenStore.set("access-1", "refresh-1", {
      expires_in: 3600,
      refresh_expires_in: 604800,
    });

    expect(await ensureFreshAccessToken()).toBe(true);
    expect(refreshTokenPair).not.toHaveBeenCalled();
  });

  it("ensureFreshAccessToken refreshes when access is expiring soon", async () => {
    tokenStore.set("access-1", "refresh-1", {
      expires_in: 30,
      refresh_expires_in: 604800,
    });
    vi.mocked(refreshTokenPair).mockResolvedValue({
      tokens: {
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 900,
        refresh_expires_in: 604800,
      },
      features: ["menus.manage"],
    });

    expect(await ensureFreshAccessToken()).toBe(true);
    expect(refreshTokenPair).toHaveBeenCalledWith("refresh-1");
    expect(tokenStore.access).toBe("new-access");
  });

  it("ensureFreshAccessToken returns false when refresh is expired", async () => {
    tokenStore.set("access-1", "refresh-1", {
      expires_in: -60,
      refresh_expires_in: -60,
    });

    expect(await ensureFreshAccessToken()).toBe(false);
    expect(refreshTokenPair).not.toHaveBeenCalled();
  });
});
