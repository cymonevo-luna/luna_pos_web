import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  orderOptionsAdminApi,
  orderOptionFormToPayload,
} from "./order-options";
import { orderOptionSchema } from "@/lib/validations";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("orderOptionSchema", () => {
  it("accepts a valid name", () => {
    const result = orderOptionSchema.safeParse({ name: "Dine-In" });
    expect(result.success).toBe(true);
  });

  it("trims whitespace from name", () => {
    const result = orderOptionSchema.safeParse({ name: "  Dine-In  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Dine-In");
    }
  });

  it("rejects a name shorter than 2 characters", () => {
    const result = orderOptionSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Name must be at least 2 characters",
      );
    }
  });

  it("rejects whitespace-only name", () => {
    const result = orderOptionSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a name longer than 100 characters", () => {
    const result = orderOptionSchema.safeParse({ name: "a".repeat(101) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.length > 0)).toBe(true);
    }
  });
});

describe("orderOptionFormToPayload", () => {
  it("trims the name before submit", () => {
    expect(orderOptionFormToPayload({ name: "  Dine-In  " })).toEqual({
      name: "Dine-In",
    });
  });
});

describe("orderOptionsAdminApi", () => {
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
          data: [],
          meta: { page: 2, per_page: 10, total: 0 },
        }),
      );

    await orderOptionsAdminApi.list({
      page: 2,
      perPage: 10,
      search: "dine",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/order-options?page=2&per_page=10&search=dine",
    );
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
  });

  it("unwraps envelope responses for get, create, update, and delete", async () => {
    const orderOption = {
      id: "opt-1",
      name: "Dine-In",
      priority: 10,
      ingredient_count: 2,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (method === "GET" && url.endsWith("/api/admin/order-options/opt-1")) {
          return jsonResponse({ success: true, data: orderOption });
        }
        if (method === "POST" && url.endsWith("/api/admin/order-options")) {
          return jsonResponse({ success: true, data: orderOption });
        }
        if (method === "PUT" && url.endsWith("/api/admin/order-options/opt-1")) {
          return jsonResponse({ success: true, data: orderOption });
        }
        if (
          method === "DELETE" &&
          url.endsWith("/api/admin/order-options/opt-1")
        ) {
          return new Response(null, { status: 204 });
        }
        return jsonResponse({ success: false }, 404);
      },
    );

    const got = await orderOptionsAdminApi.get("opt-1");
    expect(got.data).toEqual(orderOption);

    const created = await orderOptionsAdminApi.create({ name: "Dine-In" });
    expect(created.data).toEqual(orderOption);

    const updated = await orderOptionsAdminApi.update("opt-1", {
      name: "Dine-In",
    });
    expect(updated.data).toEqual(orderOption);

    await orderOptionsAdminApi.delete("opt-1");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("reorder sends PUT with order_option_ids in order", async () => {
    const orderOptions = [
      {
        id: "id-2",
        name: "Box",
        priority: 10,
        ingredient_count: 0,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "id-1",
        name: "Take Away",
        priority: 5,
        ingredient_count: 1,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (
          method === "PUT" &&
          url.endsWith("/api/admin/order-options/reorder")
        ) {
          expect(init?.body).toBe(
            JSON.stringify({ order_option_ids: ["id-2", "id-1"] }),
          );
          return jsonResponse({ success: true, data: orderOptions });
        }

        return jsonResponse({ success: false }, 404);
      },
    );

    const result = await orderOptionsAdminApi.reorder(["id-2", "id-1"]);
    expect(result.data).toEqual(orderOptions);
    expect(fetchMock).toHaveBeenCalled();
  });
});
