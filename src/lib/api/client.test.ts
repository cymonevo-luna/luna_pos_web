import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, ApiError, resetInFlightGetsForTests } from "./client";
import { tokenStore } from "@/lib/auth/tokens";
import { refreshTokenPair, resetRefreshInFlightForTests } from "@/lib/auth/refresh";

vi.mock("@/lib/auth/refresh", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/refresh")>();
  return {
    ...actual,
    refreshTokenPair: vi.fn(),
  };
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockAdminRoute() {
  vi.spyOn(window, "location", "get").mockReturnValue({
    ...window.location,
    pathname: "/admin",
    href: "/admin",
  } as Location);
}

describe("api client", () => {
  beforeEach(() => {
    tokenStore.clear();
    resetRefreshInFlightForTests();
    resetInFlightGetsForTests();
    vi.mocked(refreshTokenPair).mockReset();
    mockAdminRoute();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("unwraps the data envelope on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: { id: "1", name: "Ada" } }),
    );
    const res = await api.get<{ id: string; name: string }>("/x", {
      auth: false,
    });
    expect(res.data).toEqual({ id: "1", name: "Ada" });
  });

  it("exposes pagination meta", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: [],
        meta: { page: 1, per_page: 10, total: 42 },
      }),
    );
    const res = await api.get("/users", { auth: false });
    expect(res.meta?.total).toBe(42);
  });

  it("treats 204 No Content as success without parsing JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    const res = await api.delete<void>("/api/admin/supplier-prices/price-1", {
      auth: false,
    });
    expect(res.data).toBeUndefined();
  });

  it("deduplicates concurrent identical GET requests", async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockReturnValue(fetchPromise);

    const first = api.get<{ id: string }>("/dedupe-test", { auth: false });
    const second = api.get<{ id: string }>("/dedupe-test", { auth: false });

    resolveFetch!(jsonResponse({ success: true, data: { id: "1" } }));

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult.data).toEqual({ id: "1" });
    expect(secondResult.data).toEqual({ id: "1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws an ApiError with code and message on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: { code: "not_found", message: "missing" },
        },
        404,
      ),
    );
    await expect(api.get("/missing", { auth: false })).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      code: "not_found",
      message: "missing",
    });
  });

  it("attaches the bearer token when authenticated", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ success: true, data: null }));

    await api.get("/me");

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
  });

  it("refreshes the token once on a 401 and retries", async () => {
    tokenStore.set("expired", "refresh-1", {
      expires_in: 3600,
      refresh_expires_in: 604800,
    });
    vi.mocked(refreshTokenPair).mockResolvedValue({
      tokens: {
        access_token: "new",
        refresh_token: "newR",
        expires_in: 900,
        refresh_expires_in: 604800,
      },
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ success: false }, 401))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { ok: true } }));

    const res = await api.get<{ ok: boolean }>("/protected");
    expect(res.data.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(tokenStore.access).toBe("new");
    expect(refreshTokenPair).toHaveBeenCalledTimes(1);
  });

  it("refreshes proactively before a request when access is expiring soon", async () => {
    tokenStore.set("old-access", "refresh-1", {
      expires_in: 30,
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

    await api.get<{ ok: boolean }>("/protected");

    expect(refreshTokenPair).toHaveBeenCalledWith("refresh-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer fresh-access");
  });

  it("does not attach bearer tokens on login routes", async () => {
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      pathname: "/admin/login",
      href: "/admin/login",
    } as Location);
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ success: true, data: null }));

    await api.get("/me");

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBeNull();
    expect(refreshTokenPair).not.toHaveBeenCalled();
  });

  it("returns ApiError when InvalidJSON is received", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not json", { status: 200 }),
    );
    await expect(api.get("/bad", { auth: false })).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it("downloads a blob response with auth", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("menu,cogs", {
        status: 200,
        headers: { "Content-Type": "text/csv" },
      }),
    );

    const blob = await api.downloadBlob("/api/admin/cogs/export");
    expect(await blob.text()).toBe("menu,cogs");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8080/api/admin/cogs/export");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
  });

  it("throws ApiError when blob download fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: { code: "server_error", message: "Export failed" },
        },
        500,
      ),
    );

    await expect(
      api.downloadBlob("/api/admin/cogs/export", { auth: false }),
    ).rejects.toMatchObject({
      message: "Export failed",
      status: 500,
    });
  });
});
