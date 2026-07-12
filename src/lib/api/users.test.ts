import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  adminApi,
  adminUserCreateFormToPayload,
  adminUserRolesFormToPayload,
} from "./users";
import {
  adminUserCreateSchema,
  adminUserRolesSchema,
} from "@/lib/validations";
import { tokenStore } from "@/lib/auth/tokens";
import type { MerchantRole } from "./types";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const sampleUser = {
  id: "user-1",
  email: "cashier@example.com",
  name: "Cashier User",
  roles: ["cashier", "operational"] as const,
  merchant_id: "merchant-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

describe("adminUserCreateSchema", () => {
  it("accepts a valid create payload with multiple roles", () => {
    const result = adminUserCreateSchema.safeParse({
      email: "new@example.com",
      name: "New User",
      password: "password123",
      roles: ["cashier", "operational"],
    });
    expect(result.success).toBe(true);
  });

  it("requires at least one role", () => {
    const result = adminUserCreateSchema.safeParse({
      email: "new@example.com",
      name: "New User",
      password: "password123",
      roles: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("adminUserRolesSchema", () => {
  it("requires at least one role", () => {
    const result = adminUserRolesSchema.safeParse({ roles: [] });
    expect(result.success).toBe(false);
  });
});

describe("adminUserCreateFormToPayload", () => {
  it("trims email and name", () => {
    expect(
      adminUserCreateFormToPayload({
        email: "  new@example.com  ",
        name: "  New User  ",
        password: "password123",
        roles: ["manager"],
      }),
    ).toEqual({
      email: "new@example.com",
      name: "New User",
      password: "password123",
      roles: ["manager"],
    });
  });
});

describe("adminUserRolesFormToPayload", () => {
  it("passes roles through", () => {
    expect(
      adminUserRolesFormToPayload({ roles: ["manager", "operational"] }),
    ).toEqual({
      roles: ["manager", "operational"],
    });
  });
});

describe("adminApi", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds the correct list URL and attaches authorization", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse({
          success: true,
          data: [sampleUser],
          meta: { page: 1, per_page: 10, total: 1 },
        }),
      );

    const result = await adminApi.listUsers({
      page: 1,
      perPage: 10,
      search: "cashier",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/users?page=1&per_page=10&search=cashier",
    );
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
    expect(result.data).toEqual([sampleUser]);
  });

  it("posts create user payload", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: sampleUser,
      }),
    );

    const payload = {
      email: "new@example.com",
      name: "New User",
      password: "password123",
      roles: ["cashier", "operational"] as MerchantRole[],
    };

    await adminApi.createUser(payload);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/admin/users",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
  });

  it("puts role updates to the roles endpoint", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: { ...sampleUser, roles: ["manager"] },
      }),
    );

    await adminApi.updateUserRoles("user-1", { roles: ["manager"] });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/admin/users/user-1/roles",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ roles: ["manager"] }),
      }),
    );
  });

  it("deletes a user", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await adminApi.deleteUser("user-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/admin/users/user-1",
      expect.objectContaining({
        method: "DELETE",
      }),
    );
  });
});
