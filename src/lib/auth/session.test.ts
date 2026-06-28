import { describe, it, expect } from "vitest";
import { decodeJwt } from "./tokens";
import {
  isClaimsValid,
  needsTokenRefresh,
  resolveSessionClaims,
} from "./session";

function makeJwt(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

const futureExp = Math.floor(Date.now() / 1000) + 3600;
const pastExp = Math.floor(Date.now() / 1000) - 60;

describe("isClaimsValid", () => {
  it("accepts unexpired claims", () => {
    expect(isClaimsValid(decodeJwt(makeJwt({ exp: futureExp })))).toBe(true);
  });

  it("rejects expired claims", () => {
    expect(isClaimsValid(decodeJwt(makeJwt({ exp: pastExp })))).toBe(false);
  });
});

describe("resolveSessionClaims", () => {
  it("prefers a valid access token", () => {
    const access = makeJwt({ uid: "access", exp: futureExp });
    const refresh = makeJwt({ uid: "refresh", exp: futureExp });
    expect(resolveSessionClaims(access, refresh)?.uid).toBe("access");
  });

  it("falls back to a valid refresh token", () => {
    const access = makeJwt({ uid: "access", exp: pastExp });
    const refresh = makeJwt({ uid: "refresh", exp: futureExp });
    expect(resolveSessionClaims(access, refresh)?.uid).toBe("refresh");
  });

  it("returns null when both tokens are unusable", () => {
    const access = makeJwt({ uid: "access", exp: pastExp });
    const refresh = makeJwt({ uid: "refresh", exp: pastExp });
    expect(resolveSessionClaims(access, refresh)).toBeNull();
  });
});

describe("needsTokenRefresh", () => {
  it("is false when access is still valid", () => {
    const access = makeJwt({ exp: futureExp });
    const refresh = makeJwt({ exp: futureExp });
    expect(needsTokenRefresh(access, refresh)).toBe(false);
  });

  it("is true when access expired but refresh is valid", () => {
    const access = makeJwt({ exp: pastExp });
    const refresh = makeJwt({ exp: futureExp });
    expect(needsTokenRefresh(access, refresh)).toBe(true);
  });

  it("is false when refresh is also expired", () => {
    const access = makeJwt({ exp: pastExp });
    const refresh = makeJwt({ exp: pastExp });
    expect(needsTokenRefresh(access, refresh)).toBe(false);
  });
});
