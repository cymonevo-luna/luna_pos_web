import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { config } from "@/lib/config";
import { resetRefreshInFlightForTests } from "@/lib/auth/refresh";
import { proxy } from "@/proxy";

function makeJwt(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

const futureExp = Math.floor(Date.now() / 1000) + 3600;
const pastExp = Math.floor(Date.now() / 1000) - 60;

function requestFor(path: string, cookies: Record<string, string> = {}) {
  const url = `http://localhost:3000${path}`;
  const req = new NextRequest(url);
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value);
  }
  return req;
}

describe("proxy", () => {
  beforeEach(() => {
    resetRefreshInFlightForTests();
    vi.restoreAllMocks();
  });

  it("allows protected routes when access is expired but refresh is valid", async () => {
    const access = makeJwt({
      uid: "1",
      roles: ["operational"],
      merchant_id: "merchant-1",
      exp: pastExp,
    });
    const refresh = makeJwt({
      uid: "1",
      roles: ["operational"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            tokens: {
              access_token: makeJwt({
                uid: "1",
                roles: ["operational"],
                merchant_id: "merchant-1",
                exp: futureExp,
              }),
              refresh_token: makeJwt({
                uid: "1",
                roles: ["operational"],
                merchant_id: "merchant-1",
                exp: futureExp,
              }),
              expires_in: 900,
            },
          },
        }),
      }),
    );

    const res = await proxy(
      requestFor("/dashboard", {
        [config.cookies.accessToken]: access,
        [config.cookies.refreshToken]: refresh,
      }),
    );

    expect(res.status).toBe(200);
    expect(res.cookies.get(config.cookies.accessToken)?.value).toBeTruthy();
  });

  it("redirects to login when refresh fails", async () => {
    const access = makeJwt({
      uid: "1",
      roles: ["operational"],
      merchant_id: "merchant-1",
      exp: pastExp,
    });
    const refresh = makeJwt({
      uid: "1",
      roles: ["operational"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
      }),
    );

    const res = await proxy(
      requestFor("/dashboard", {
        [config.cookies.accessToken]: access,
        [config.cookies.refreshToken]: refresh,
      }),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
    expect(res.cookies.get(config.cookies.accessToken)?.value).toBe("");
  });

  it("redirects unauthenticated users to login", async () => {
    const res = await proxy(requestFor("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects admin-only users away from manager routes", async () => {
    const access = makeJwt({
      uid: "1",
      roles: ["admin"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });

    const res = await proxy(
      requestFor("/admin/cogs", {
        [config.cookies.accessToken]: access,
      }),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin/users");
  });

  it("redirects operational users away from admin routes", async () => {
    const access = makeJwt({
      uid: "1",
      roles: ["operational"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });

    const res = await proxy(
      requestFor("/admin/users", {
        [config.cookies.accessToken]: access,
      }),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin/suppliers");
  });

  it("allows manager users on manager routes", async () => {
    const access = makeJwt({
      uid: "1",
      roles: ["manager"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });

    const res = await proxy(
      requestFor("/admin/cogs", {
        [config.cookies.accessToken]: access,
      }),
    );

    expect(res.status).toBe(200);
  });

  it("redirects manager-only users away from purchase requests", async () => {
    const access = makeJwt({
      uid: "1",
      roles: ["manager"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });

    const res = await proxy(
      requestFor("/admin/purchases", {
        [config.cookies.accessToken]: access,
      }),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin");
  });

  it("redirects operational users away from production requests", async () => {
    const access = makeJwt({
      uid: "1",
      roles: ["operational"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });

    const res = await proxy(
      requestFor("/admin/production-requests/new", {
        [config.cookies.accessToken]: access,
      }),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin/suppliers");
  });

  it("allows admin-only users on production request list route", async () => {
    const access = makeJwt({
      uid: "1",
      roles: ["admin"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });

    const res = await proxy(
      requestFor("/admin/production-requests", {
        [config.cookies.accessToken]: access,
      }),
    );

    expect(res.status).toBe(200);
  });

  it("allows admin-only users on production request detail route", async () => {
    const access = makeJwt({
      uid: "1",
      roles: ["admin"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });

    const res = await proxy(
      requestFor("/admin/production-requests/some-id", {
        [config.cookies.accessToken]: access,
      }),
    );

    expect(res.status).toBe(200);
  });

  it("redirects admin-only users away from production request create route", async () => {
    const access = makeJwt({
      uid: "1",
      roles: ["admin"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });

    const res = await proxy(
      requestFor("/admin/production-requests/new", {
        [config.cookies.accessToken]: access,
      }),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin/users");
  });

  it("allows manager users on production request list route", async () => {
    const access = makeJwt({
      uid: "1",
      roles: ["manager"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });

    const res = await proxy(
      requestFor("/admin/production-requests", {
        [config.cookies.accessToken]: access,
      }),
    );

    expect(res.status).toBe(200);
  });

  it("allows manager users on production request create route", async () => {
    const access = makeJwt({
      uid: "1",
      roles: ["manager"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });

    const res = await proxy(
      requestFor("/admin/production-requests/new", {
        [config.cookies.accessToken]: access,
      }),
    );

    expect(res.status).toBe(200);
  });

  it("redirects admin-only users away from supplier routes", async () => {
    const access = makeJwt({
      uid: "1",
      roles: ["admin"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });

    const res = await proxy(
      requestFor("/admin/suppliers", {
        [config.cookies.accessToken]: access,
      }),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin/users");
  });

  it("allows operational users on supplier routes", async () => {
    const access = makeJwt({
      uid: "1",
      roles: ["operational"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });

    const res = await proxy(
      requestFor("/admin/suppliers", {
        [config.cookies.accessToken]: access,
      }),
    );

    expect(res.status).toBe(200);
  });

  it("redirects operational users away from receipt settings", async () => {
    const access = makeJwt({
      uid: "1",
      roles: ["operational"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });

    const res = await proxy(
      requestFor("/admin/store-settings", {
        [config.cookies.accessToken]: access,
      }),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin/suppliers");
  });

  it("allows manager users on transaction history routes", async () => {
    const access = makeJwt({
      uid: "1",
      roles: ["manager"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });

    const res = await proxy(
      requestFor("/admin/transactions", {
        [config.cookies.accessToken]: access,
      }),
    );

    expect(res.status).toBe(200);
  });

  it("allows manager users on cash flow routes", async () => {
    const access = makeJwt({
      uid: "1",
      roles: ["manager"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });

    const res = await proxy(
      requestFor("/admin/cash-flow", {
        [config.cookies.accessToken]: access,
      }),
    );

    expect(res.status).toBe(200);
  });

  it("redirects operational users away from cash flow", async () => {
    const access = makeJwt({
      uid: "1",
      roles: ["operational"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });

    const res = await proxy(
      requestFor("/admin/cash-flow", {
        [config.cookies.accessToken]: access,
      }),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin/suppliers");
  });

  it("allows manager users on branch assets summary routes", async () => {
    const access = makeJwt({
      uid: "1",
      roles: ["manager"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });

    const res = await proxy(
      requestFor("/admin/branch-assets/summary", {
        [config.cookies.accessToken]: access,
      }),
    );

    expect(res.status).toBe(200);
  });

  it("redirects cashier users away from branch assets summary", async () => {
    const access = makeJwt({
      uid: "1",
      roles: ["cashier"],
      merchant_id: "merchant-1",
      exp: futureExp,
    });

    const res = await proxy(
      requestFor("/admin/branch-assets/summary", {
        [config.cookies.accessToken]: access,
      }),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard");
  });
});
