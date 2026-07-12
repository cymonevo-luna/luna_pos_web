import { beforeEach, describe, expect, it, vi } from "vitest";
import { authApi } from "@/lib/api/auth";
import { tokenStore } from "@/lib/auth/tokens";
import { getTestLoginPath, loginAsTestAccount } from "@/testing/auth";

vi.mock("@/lib/api/auth", () => ({
  authApi: {
    login: vi.fn(),
  },
}));

vi.mock("@/lib/auth/tokens", () => ({
  tokenStore: {
    set: vi.fn(),
  },
}));

const loginResult = {
  user: {
    id: "user-1",
    email: "admin-test@cymonevo.com",
    name: "Admin Test",
    role: "admin" as const,
    roles: ["admin" as const],
    merchant_id: "merchant-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  merchant: { id: "merchant-1", name: "Test Merchant" },
  tokens: {
    access_token: "access-token",
    refresh_token: "refresh-token",
    expires_in: 3600,
  },
};

describe("getTestLoginPath", () => {
  it("routes cashier flows to the user login page", () => {
    expect(getTestLoginPath("cashier")).toBe("/login");
  });

  it("routes merchant-area roles to the admin login page", () => {
    expect(getTestLoginPath("admin")).toBe("/admin/login");
    expect(getTestLoginPath("manager")).toBe("/admin/login");
    expect(getTestLoginPath("operational")).toBe("/admin/login");
  });
});

describe("loginAsTestAccount", () => {
  beforeEach(() => {
    vi.mocked(authApi.login).mockResolvedValue({ data: loginResult });
    vi.mocked(tokenStore.set).mockClear();
  });

  it("logs in via POST /api/v1/auth/login with the dedicated admin account", async () => {
    const result = await loginAsTestAccount("admin", { persistSession: false });

    expect(authApi.login).toHaveBeenCalledWith({
      email: "admin-test@cymonevo.com",
      password: "LunaTesting123!",
    });
    expect(result).toEqual(loginResult);
    expect(tokenStore.set).not.toHaveBeenCalled();
  });

  it("persists the session in tokenStore by default in browser contexts", async () => {
    await loginAsTestAccount("manager");

    expect(authApi.login).toHaveBeenCalledWith({
      email: "manager-test@cymonevo.com",
      password: "LunaTesting123!",
    });
    expect(tokenStore.set).toHaveBeenCalledWith("access-token", "refresh-token");
  });

  it("logs in via POST /api/v1/auth/login with the dedicated cashier account", async () => {
    await loginAsTestAccount("cashier", { persistSession: false });

    expect(authApi.login).toHaveBeenCalledWith({
      email: "cashier-test@cymonevo.com",
      password: "LunaTesting123!",
    });
  });

  it("logs in via POST /api/v1/auth/login with the dedicated operational account", async () => {
    await loginAsTestAccount("operational", { persistSession: false });

    expect(authApi.login).toHaveBeenCalledWith({
      email: "operation-test@cymonevo.com",
      password: "LunaTesting123!",
    });
  });

  it("loginAsRole alias delegates to loginAsTestAccount", async () => {
    const { loginAsRole } = await import("@/testing/auth");
    await loginAsRole("admin", { persistSession: false });

    expect(authApi.login).toHaveBeenCalledWith({
      email: "admin-test@cymonevo.com",
      password: "LunaTesting123!",
    });
  });
});
