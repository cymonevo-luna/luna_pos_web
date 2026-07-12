import { describe, it, expect, vi, beforeEach } from "vitest";
import { authApi } from "./auth";
import { config } from "@/lib/config";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("authApi.login", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts to /api/v1/auth/login with JSON credentials and no cookies", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse({
          success: true,
          data: {
            tokens: {
              access_token: "access",
              refresh_token: "refresh",
              expires_in: 900,
            },
            user: {
              id: "1",
              email: "admin@example.com",
              name: "Admin",
              role: "admin",
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
          },
        }),
      );

    const payload = { email: "admin@example.com", password: "secret" };
    const { data } = await authApi.login(payload);

    expect(data.user.role).toBe("admin");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${config.apiBaseUrl}/api/v1/auth/login`);
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("omit");
    expect(new Headers(init?.headers).get("Content-Type")).toBe(
      "application/json",
    );
    expect(JSON.parse(String(init?.body))).toEqual(payload);
    expect(new Headers(init?.headers).get("Authorization")).toBeNull();
  });
});
