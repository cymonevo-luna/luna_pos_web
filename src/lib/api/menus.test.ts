import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  menusAdminApi,
  isAbsolutePhotoUrl,
  menuBasicFormToPayload,
  menuCogsFormToPayload,
  menuFullFormToPayload,
  menuFormToPayload,
} from "./menus";
import { menuBasicSchema, menuCogsSchema, menuSchema } from "@/lib/validations";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("menuBasicSchema", () => {
  const base = {
    title: "Nasi Goreng",
    category_id: "cat-1",
    available_stock: 10,
    sell_price: 25000,
  };

  it("accepts a valid payload", () => {
    expect(menuBasicSchema.safeParse(base).success).toBe(true);
  });

  it("accepts optional description and empty photo URL", () => {
    expect(
      menuBasicSchema.safeParse({
        ...base,
        description: "Spicy fried rice",
        photo_url: "",
      }).success,
    ).toBe(true);
  });

  it("accepts a valid photo URL", () => {
    expect(
      menuBasicSchema.safeParse({
        ...base,
        photo_url: "https://example.com/food.jpg",
      }).success,
    ).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = menuBasicSchema.safeParse({ ...base, title: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("Title"))).toBe(
        true,
      );
    }
  });

  it("rejects a missing category", () => {
    const result = menuBasicSchema.safeParse({ ...base, category_id: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes("Category")),
      ).toBe(true);
    }
  });

  it("rejects negative available stock", () => {
    const result = menuBasicSchema.safeParse({ ...base, available_stock: -1 });
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
    const result = menuBasicSchema.safeParse({ ...base, sell_price: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes("greater than 0")),
      ).toBe(true);
    }
  });

  it("rejects an invalid photo URL", () => {
    const result = menuBasicSchema.safeParse({ ...base, photo_url: "not-a-url" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes("valid URL")),
      ).toBe(true);
    }
  });
});

describe("menuCogsSchema", () => {
  const base = {
    recipe_yield: 1,
    margin_percent: 0,
    vat_percent: 0,
  };

  it("accepts a valid payload", () => {
    expect(menuCogsSchema.safeParse(base).success).toBe(true);
  });

  it("rejects recipe yield below 1", () => {
    const result = menuCogsSchema.safeParse({ ...base, recipe_yield: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.message.includes("Recipe yield must be at least 1"),
        ),
      ).toBe(true);
    }
  });

  it("rejects negative margin and VAT", () => {
    expect(menuCogsSchema.safeParse({ ...base, margin_percent: -1 }).success).toBe(
      false,
    );
    expect(menuCogsSchema.safeParse({ ...base, vat_percent: -1 }).success).toBe(
      false,
    );
  });

  it("accepts decimal margin and VAT values", () => {
    expect(
      menuCogsSchema.safeParse({
        ...base,
        margin_percent: 30.5,
        vat_percent: 11.25,
      }).success,
    ).toBe(true);
  });
});

describe("menuSchema", () => {
  const base = {
    title: "Nasi Goreng",
    category_id: "cat-1",
    available_stock: 10,
    sell_price: 25000,
    recipe_yield: 1,
    margin_percent: 0,
    vat_percent: 0,
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

  it("rejects recipe yield below 1", () => {
    const result = menuSchema.safeParse({ ...base, recipe_yield: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.message.includes("Recipe yield must be at least 1"),
        ),
      ).toBe(true);
    }
  });

  it("rejects negative margin and VAT", () => {
    expect(menuSchema.safeParse({ ...base, margin_percent: -1 }).success).toBe(
      false,
    );
    expect(menuSchema.safeParse({ ...base, vat_percent: -1 }).success).toBe(
      false,
    );
  });

  it("accepts decimal margin and VAT values", () => {
    expect(
      menuSchema.safeParse({
        ...base,
        margin_percent: 30.5,
        vat_percent: 11.25,
      }).success,
    ).toBe(true);
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
      recipe_yield: 40,
      margin_percent: 30,
      vat_percent: 11,
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
      recipe_yield: 1,
      margin_percent: 0,
      vat_percent: 0,
    });
    expect(created.data).toEqual(menu);

    const updated = await menusAdminApi.update("menu-1", {
      title: "Nasi Goreng",
      category_id: "cat-1",
      available_stock: 10,
      sell_price: 25000,
      recipe_yield: 1,
      margin_percent: 0,
      vat_percent: 0,
    });
    expect(updated.data).toEqual(menu);

    await menusAdminApi.delete("menu-1");
    expect(fetchMock).toHaveBeenCalled();
  });
});

describe("isAbsolutePhotoUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isAbsolutePhotoUrl("https://cdn.example.com/a.jpg")).toBe(true);
    expect(isAbsolutePhotoUrl("http://cdn.example.com/a.jpg")).toBe(true);
    expect(isAbsolutePhotoUrl("  https://cdn.example.com/a.jpg  ")).toBe(true);
  });

  it("rejects relative paths, empty values, and other schemes", () => {
    expect(isAbsolutePhotoUrl("/static/default-food.png")).toBe(false);
    expect(isAbsolutePhotoUrl("/static/uploads/food.jpg")).toBe(false);
    expect(isAbsolutePhotoUrl("")).toBe(false);
    expect(isAbsolutePhotoUrl("   ")).toBe(false);
    expect(isAbsolutePhotoUrl("ftp://cdn.example.com/a.jpg")).toBe(false);
  });
});

describe("menuBasicFormToPayload", () => {
  const base = {
    title: "Batch Soup",
    description: "",
    category_id: "cat-1",
    available_stock: 10,
    sell_price: 25000,
  };

  it("maps basic fields only and omits COGS keys", () => {
    const payload = menuBasicFormToPayload({
      ...base,
      photo_url: "",
    });

    expect(payload).toEqual({
      title: "Batch Soup",
      category_id: "cat-1",
      available_stock: 10,
      sell_price: 25000,
    });
    expect(payload).not.toHaveProperty("recipe_yield");
    expect(payload).not.toHaveProperty("margin_percent");
    expect(payload).not.toHaveProperty("vat_percent");
  });

  it("omits photo_url for default relative path", () => {
    const payload = menuBasicFormToPayload({
      ...base,
      photo_url: "/static/default-food.png",
    });

    expect(payload).not.toHaveProperty("photo_url");
  });

  it("omits photo_url for other relative paths", () => {
    const payload = menuBasicFormToPayload({
      ...base,
      photo_url: "/static/uploads/food.jpg",
    });

    expect(payload).not.toHaveProperty("photo_url");
  });

  it("includes photo_url for absolute https URLs", () => {
    const payload = menuBasicFormToPayload({
      ...base,
      photo_url: "https://cdn.example.com/a.jpg",
    });

    expect(payload.photo_url).toBe("https://cdn.example.com/a.jpg");
  });

  it("omits photo_url for null-like empty values", () => {
    const payload = menuBasicFormToPayload({
      ...base,
      photo_url: "   ",
    });

    expect(payload).not.toHaveProperty("photo_url");
  });
});

describe("menuCogsFormToPayload", () => {
  it("returns only COGS fields", () => {
    expect(
      menuCogsFormToPayload({
        recipe_yield: 40,
        margin_percent: 30,
        vat_percent: 11,
      }),
    ).toEqual({
      recipe_yield: 40,
      margin_percent: 30,
      vat_percent: 11,
    });
  });
});

describe("menuFullFormToPayload", () => {
  it("merges basic and COGS payloads", () => {
    expect(
      menuFullFormToPayload(
        {
          title: "Batch Soup",
          description: "",
          category_id: "cat-1",
          photo_url: "",
          available_stock: 10,
          sell_price: 25000,
        },
        {
          recipe_yield: 40,
          margin_percent: 30,
          vat_percent: 11,
        },
      ),
    ).toEqual({
      title: "Batch Soup",
      category_id: "cat-1",
      available_stock: 10,
      sell_price: 25000,
      recipe_yield: 40,
      margin_percent: 30,
      vat_percent: 11,
    });
  });

  it("omits resolved default photo_url from COGS save payload", () => {
    const payload = menuFullFormToPayload(
      {
        title: "Nasi Goreng",
        description: "Spicy fried rice",
        category_id: "cat-1",
        photo_url: "/static/default-food.png",
        available_stock: 10,
        sell_price: 25000,
      },
      {
        recipe_yield: 1,
        margin_percent: 25,
        vat_percent: 0,
      },
    );

    expect(payload).not.toHaveProperty("photo_url");
    expect(payload).toEqual({
      title: "Nasi Goreng",
      description: "Spicy fried rice",
      category_id: "cat-1",
      available_stock: 10,
      sell_price: 25000,
      recipe_yield: 1,
      margin_percent: 25,
      vat_percent: 0,
    });
  });

  it("retains absolute photo_url in COGS save payload", () => {
    const payload = menuFullFormToPayload(
      {
        title: "Nasi Goreng",
        description: "",
        category_id: "cat-1",
        photo_url: "https://cdn.example.com/custom.jpg",
        available_stock: 10,
        sell_price: 25000,
      },
      {
        recipe_yield: 1,
        margin_percent: 25,
        vat_percent: 0,
      },
    );

    expect(payload.photo_url).toBe("https://cdn.example.com/custom.jpg");
  });
});

describe("menuFormToPayload", () => {
  it("includes COGS fields in the API payload", () => {
    expect(
      menuFormToPayload({
        title: "Batch Soup",
        description: "",
        category_id: "cat-1",
        photo_url: "",
        available_stock: 10,
        sell_price: 25000,
        recipe_yield: 40,
        margin_percent: 30,
        vat_percent: 11,
      }),
    ).toEqual({
      title: "Batch Soup",
      category_id: "cat-1",
      available_stock: 10,
      sell_price: 25000,
      recipe_yield: 40,
      margin_percent: 30,
      vat_percent: 11,
    });
  });
});
