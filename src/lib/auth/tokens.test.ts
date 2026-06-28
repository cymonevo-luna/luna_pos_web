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
    const token = makeJwt({ uid: "1", role: "admin", exp: 123 });
    const claims = decodeJwt(token);
    expect(claims?.uid).toBe("1");
    expect(claims?.role).toBe("admin");
  });

  it("returns null for malformed tokens", () => {
    expect(decodeJwt("garbage")).toBeNull();
  });
});

describe("tokenStore", () => {
  beforeEach(() => {
    tokenStore.clear();
  });

  it("persists and reads tokens via cookies", () => {
    tokenStore.set("access-1", "refresh-1");
    expect(tokenStore.access).toBe("access-1");
    expect(tokenStore.refresh).toBe("refresh-1");
    expect(readCookie(config.cookies.accessToken)).toBe("access-1");
  });

  it("clears tokens", () => {
    tokenStore.set("a", "b");
    tokenStore.clear();
    expect(tokenStore.access).toBeNull();
    expect(tokenStore.refresh).toBeNull();
  });
});
