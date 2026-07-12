import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "./context";
import { authApi } from "@/lib/api/auth";
import { adminApi, usersApi } from "@/lib/api/users";
import { tokenStore } from "@/lib/auth/tokens";
import { config } from "@/lib/config";
import type { User } from "@/lib/api/types";

vi.mock("@/lib/api/auth", () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
  },
}));

vi.mock("@/lib/api/users", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/users")>();
  return {
    ...actual,
    usersApi: {
      ...actual.usersApi,
      get: vi.fn(),
    },
  };
});

const adminUser: User = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin User",
  role: "admin",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("AuthProvider login", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.clearAllMocks();
    vi.mocked(usersApi.get).mockRejectedValue(new Error("skip hydrate"));
  });

  it("stores tokens and exposes admin role after admin login", async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      data: {
        tokens: {
          access_token: "admin-access",
          refresh_token: "admin-refresh",
          expires_in: 900,
        },
        user: adminUser,
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const user = await result.current.login({
        email: "admin@example.com",
        password: "secret",
      });
      expect(user.role).toBe("admin");
    });

    expect(tokenStore.access).toBe("admin-access");
    expect(tokenStore.refresh).toBe("admin-refresh");
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.user).toEqual(adminUser);
  });

  it("supports authenticated admin API calls after login", async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      data: {
        tokens: {
          access_token: "admin-access",
          refresh_token: "admin-refresh",
          expires_in: 900,
        },
        user: adminUser,
      },
    });

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: [adminUser],
            meta: { page: 1, per_page: 10, total: 1 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.login({
        email: "admin@example.com",
        password: "secret",
      });
    });

    const { data } = await adminApi.listUsers();

    expect(data).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${config.apiBaseUrl}/api/admin/users?page=1&per_page=10`);
    expect(init?.credentials).toBe("omit");
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer admin-access",
    );
  });
});
