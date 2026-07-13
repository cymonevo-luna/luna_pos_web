import { describe, it, expect, beforeEach } from "vitest";
import {
  getTokens,
  isAccessExpiringSoon,
  isRefreshValid,
  setTokens,
} from "./token-helpers";
import { tokenStore } from "./tokens";

describe("token helpers", () => {
  beforeEach(() => {
    tokenStore.clear();
    localStorage.clear();
  });

  it("getTokens returns stored token metadata", () => {
    tokenStore.set("access-1", "refresh-1", { expires_in: 900 });
    const tokens = getTokens();
    expect(tokens.accessToken).toBe("access-1");
    expect(tokens.refreshToken).toBe("refresh-1");
    expect(tokens.accessExpiresAt).toBeTruthy();
    expect(tokens.refreshExpiresAt).toBeTruthy();
  });

  it("setTokens persists a token pair", () => {
    setTokens({
      access_token: "new-access",
      refresh_token: "new-refresh",
      expires_in: 900,
      refresh_expires_in: 604800,
    });
    expect(tokenStore.access).toBe("new-access");
    expect(tokenStore.refresh).toBe("new-refresh");
  });

  it("isAccessExpiringSoon is true inside the buffer window", () => {
    const now = Date.now();
    tokenStore.set("access-1", "refresh-1", { expires_in: 60 });
    expect(isAccessExpiringSoon(120, now)).toBe(true);
  });

  it("isAccessExpiringSoon is false when access has ample lifetime", () => {
    const now = Date.now();
    tokenStore.set("access-1", "refresh-1", { expires_in: 3600 });
    expect(isAccessExpiringSoon(120, now)).toBe(false);
  });

  it("isRefreshValid reflects refresh expiry metadata", () => {
    const now = Date.now();
    tokenStore.set("access-1", "refresh-1", {
      expires_in: 3600,
      refresh_expires_in: 604800,
    });
    expect(isRefreshValid(now + 604_000_000)).toBe(true);
    expect(isRefreshValid(now + 604_801_000)).toBe(false);
  });
});
