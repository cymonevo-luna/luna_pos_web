import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { menusAdminApi } from "./menus";
import { menuSchema } from "@/lib/validations";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("menuSchema", () => {
  const base = {
    title: "Nasi Goreng",
    category_id: "cat-1",
    available_stock: 10,
    sell_price: 25000,
  };

  it("accepts a valid payload", () => {
    expect(menuSchema.safeParse(base).success).toBe(true);
  });

  it("accepts optional description and empty photo URL", () => {
    expect(
      menuSchema.safeParse({
        ...base,
        description: "Spicy fried rice",
        photo_url: "",
      }).success,
    ).toBe(true);
  });

  it("accepts a valid photo URL", () => {
    expect(
      menuSchema.safeParse({
        ...base,
        photo_url: "https://example.com/food.jpg",
      }).success,
    ).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = menuSchema.safeParse({ ...base, title: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("Title"))).toBe(
        true,
      );
    }
  });

  it("rejects a missing category", () => {
    const result = menuSchema.safeParse({ ...base, category_id: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes("Category")),
      ).toBe(true);
    }
  });

  it("rejects negative available stock", () => {
    const result = menuSchema.safeParse({ ...base, available_stock: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.message.includes("cannot be negative"),
        ),
      ).toBe(true);
    }
  });

  it("rejects non-positive sell price", () => {
    const result = menuSchema.safeParse({ ...base, sell_price: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes("greater than 0")),
      ).toBe(true);
    }
  });

  it("rejects an invalid photo URL", () => {
    const result = menuSchema.safeParse({ ...base, photo_url: "not-a-url" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes("valid URL")),
      ).toBe(true);
    }
  });
});

describe("menusAdminApi", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds the correct list URL with filters and attaches authorization", async () => {
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

    await menusAdminApi.list({
      page: 2,
      perPage: 10,
      search: "nasi",
      categoryId: "cat-1",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/menus?page=2&per_page=10&search=nasi&category_id=cat-1",
    );
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
  });

  it("unwraps envelope responses for get, create, update, and delete", async () => {
    const menu = {
      id: "menu-1",
      title: "Nasi Goreng",
      description: null,
      category_id: "cat-1",
      category_name: "Main",
      photo_url: null,
      available_stock: 10,
      sell_price: 25000,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (method === "GET" && url.endsWith("/api/admin/menus/menu-1")) {
          return jsonResponse({ success: true, data: menu });
        }
        if (method === "POST" && url.endsWith("/api/admin/menus")) {
          return jsonResponse({ success: true, data: menu });
        }
        if (method === "PUT" && url.endsWith("/api/admin/menus/menu-1")) {
          return jsonResponse({ success: true, data: menu });
        }
        if (method === "DELETE" && url.endsWith("/api/admin/menus/menu-1")) {
          return new Response(null, { status: 204 });
        }
        return jsonResponse({ success: false }, 404);
      },
    );

    const got = await menusAdminApi.get("menu-1");
    expect(got.data).toEqual(menu);

    const created = await menusAdminApi.create({
      title: "Nasi Goreng",
      category_id: "cat-1",
      available_stock: 10,
      sell_price: 25000,
    });
    expect(created.data).toEqual(menu);

    const updated = await menusAdminApi.update("menu-1", {
      title: "Nasi Goreng",
      category_id: "cat-1",
      available_stock: 10,
      sell_price: 25000,
    });
    expect(updated.data).toEqual(menu);

    await menusAdminApi.delete("menu-1");
    expect(fetchMock).toHaveBeenCalled();
  });
});
