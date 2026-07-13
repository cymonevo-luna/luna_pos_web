import { describe, it, expect, beforeEach } from "vitest";
import { decodeJwt, tokenStore, readCookie } from "./tokens";
import { config } from "@/lib/config";

function makeJwt(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

describe("decodeJwt", () => {
  it("decodes a valid payload", () => {
    const token = makeJwt({
      uid: "1",
      roles: ["admin"],
      merchant_id: "merchant-1",
      exp: 123,
    });
    const claims = decodeJwt(token);
    expect(claims?.uid).toBe("1");
    expect(claims?.roles).toEqual(["admin"]);
    expect(claims?.merchant_id).toBe("merchant-1");
  });

  it("returns null for malformed tokens", () => {
    expect(decodeJwt("garbage")).toBeNull();
  });
});

describe("tokenStore", () => {
  beforeEach(() => {
    tokenStore.clear();
    localStorage.clear();
  });

  it("persists and reads tokens via localStorage", () => {
    tokenStore.set("access-1", "refresh-1", { expires_in: 3600 });
    expect(tokenStore.access).toBe("access-1");
    expect(tokenStore.refresh).toBe("refresh-1");
    expect(localStorage.getItem(config.tokens.accessToken)).toBe("access-1");
    expect(localStorage.getItem(config.tokens.refreshToken)).toBe("refresh-1");
    expect(localStorage.getItem(config.tokens.accessExpiresAt)).toBeTruthy();
    expect(localStorage.getItem(config.tokens.refreshExpiresAt)).toBeTruthy();
    expect(readCookie(config.cookies.accessToken)).toBe("access-1");
  });

  it("persists expiry metadata from token pairs", () => {
    const now = Date.now();
    tokenStore.setFromPair({
      access_token: "access-1",
      refresh_token: "refresh-1",
      expires_in: 900,
      refresh_expires_in: 604800,
    });

    expect(tokenStore.isAccessValid(now + 800_000)).toBe(true);
    expect(tokenStore.isAccessValid(now + 901_000)).toBe(false);
    expect(tokenStore.isRefreshValid(now + 604_000_000)).toBe(true);
    expect(tokenStore.isRefreshValid(now + 604_801_000)).toBe(false);
  });

  it("clears tokens from localStorage and cookies", () => {
    tokenStore.set("a", "b");
    tokenStore.clear();
    expect(tokenStore.access).toBeNull();
    expect(tokenStore.refresh).toBeNull();
    expect(localStorage.getItem(config.tokens.accessToken)).toBeNull();
    expect(localStorage.getItem(config.tokens.refreshToken)).toBeNull();
    expect(localStorage.getItem(config.tokens.accessExpiresAt)).toBeNull();
    expect(localStorage.getItem(config.tokens.refreshExpiresAt)).toBeNull();
    expect(readCookie(config.cookies.accessToken)).toBeNull();
  });

  it("migrates legacy cookie tokens into localStorage on first read", () => {
    const secure = "";
    document.cookie = `${config.cookies.accessToken}=legacy-access; Path=/; Max-Age=3600; SameSite=Lax${secure}`;
    document.cookie = `${config.cookies.refreshToken}=legacy-refresh; Path=/; Max-Age=3600; SameSite=Lax${secure}`;

    expect(tokenStore.access).toBe("legacy-access");
    expect(tokenStore.refresh).toBe("legacy-refresh");
    expect(localStorage.getItem(config.tokens.accessToken)).toBe("legacy-access");
    expect(localStorage.getItem(config.tokens.refreshToken)).toBe("legacy-refresh");
  });
});
