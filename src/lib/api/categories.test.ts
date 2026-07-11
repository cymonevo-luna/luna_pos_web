import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { categoriesAdminApi, categoryFormToPayload } from "./categories";
import { categorySchema } from "@/lib/validations";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("categorySchema", () => {
  it("accepts a valid name", () => {
    const result = categorySchema.safeParse({ name: "Desserts" });
    expect(result.success).toBe(true);
  });

  it("trims whitespace from name", () => {
    const result = categorySchema.safeParse({ name: "  Desserts  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Desserts");
    }
  });

  it("rejects an empty name", () => {
    const result = categorySchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Name is required");
    }
  });

  it("rejects whitespace-only name", () => {
    const result = categorySchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Name is required");
    }
  });

  it("rejects a name longer than 120 characters", () => {
    const result = categorySchema.safeParse({ name: "a".repeat(121) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.length > 0)).toBe(true);
    }
  });
});

describe("categoryFormToPayload", () => {
  it("trims the name before submit", () => {
    expect(categoryFormToPayload({ name: "  Desserts  " })).toEqual({
      name: "Desserts",
    });
  });
});

describe("categoriesAdminApi", () => {
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

    await categoriesAdminApi.list({
      page: 2,
      perPage: 10,
      search: "dess",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/categories?page=2&per_page=10&search=dess",
    );
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
  });

  it("unwraps envelope responses for get, create, update, and delete", async () => {
    const category = {
      id: "cat-1",
      name: "Desserts",
      priority: 0,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (method === "GET" && url.endsWith("/api/admin/categories/cat-1")) {
          return jsonResponse({ success: true, data: category });
        }
        if (method === "POST" && url.endsWith("/api/admin/categories")) {
          return jsonResponse({ success: true, data: category });
        }
        if (method === "PUT" && url.endsWith("/api/admin/categories/cat-1")) {
          return jsonResponse({ success: true, data: category });
        }
        if (
          method === "DELETE" &&
          url.endsWith("/api/admin/categories/cat-1")
        ) {
          return new Response(null, { status: 204 });
        }
        return jsonResponse({ success: false }, 404);
      },
    );

    const got = await categoriesAdminApi.get("cat-1");
    expect(got.data).toEqual(category);

    const created = await categoriesAdminApi.create({ name: "Desserts" });
    expect(created.data).toEqual(category);

    const updated = await categoriesAdminApi.update("cat-1", {
      name: "Desserts",
    });
    expect(updated.data).toEqual(category);

    await categoriesAdminApi.delete("cat-1");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("reorder sends PUT with category_ids in order", async () => {
    const categories = [
      {
        id: "id-2",
        name: "Second",
        priority: 0,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "id-1",
        name: "First",
        priority: 1,
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
          url.endsWith("/api/admin/categories/reorder")
        ) {
          expect(init?.body).toBe(
            JSON.stringify({ category_ids: ["id-2", "id-1"] }),
          );
          return jsonResponse({ success: true, data: categories });
        }

        return jsonResponse({ success: false }, 404);
      },
    );

    const result = await categoriesAdminApi.reorder(["id-2", "id-1"]);
    expect(result.data).toEqual(categories);
    expect(fetchMock).toHaveBeenCalled();
  });
});
