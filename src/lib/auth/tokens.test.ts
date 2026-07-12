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
