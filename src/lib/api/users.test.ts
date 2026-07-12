import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { adminApi } from "./users";
import { tokenStore } from "@/lib/auth/tokens";
import { config } from "@/lib/config";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("adminApi", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists users at /api/admin/users with bearer token and no cookies", async () => {
    tokenStore.set("admin-access", "admin-refresh");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse({
          success: true,
          data: [],
          meta: { page: 1, per_page: 10, total: 0 },
        }),
      );

    await adminApi.listUsers();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${config.apiBaseUrl}/api/admin/users?page=1&per_page=10`);
    expect(init?.method).toBe("GET");
    expect(init?.credentials).toBe("omit");
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer admin-access",
    );
  });

  it("fetches a single admin user by id", async () => {
    tokenStore.set("admin-access", "admin-refresh");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse({
          success: true,
          data: {
            id: "user-1",
            email: "user@example.com",
            name: "User",
            role: "user",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        }),
      );

    const { data } = await adminApi.getUser("user-1");

    expect(data.id).toBe("user-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${config.apiBaseUrl}/api/admin/users/user-1`);
    expect(init?.credentials).toBe("omit");
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer admin-access",
    );
  });
});
