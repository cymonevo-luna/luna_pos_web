import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, ApiError } from "./client";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api client", () => {
  beforeEach(() => {
    tokenStore.clear();
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
    tokenStore.set("expired", "refresh-1");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ success: false }, 401))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { tokens: { access_token: "new", refresh_token: "newR" } },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { ok: true } }));

    const res = await api.get<{ ok: boolean }>("/protected");
    expect(res.data.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(tokenStore.access).toBe("new");
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
