import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  branchAssetsAdminApi,
  branchAssetFormToPayload,
  listBranchAssets,
  normalizeBranchAsset,
} from "./branch-assets";
import { branchAssetSchema } from "@/lib/validations";
import { tokenStore } from "@/lib/auth/tokens";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("branchAssetSchema", () => {
  const base = {
    title: "Espresso machine",
    quantity: 2,
    price_amount: 15_000_000,
  };

  it("accepts a valid payload", () => {
    const result = branchAssetSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("accepts optional description and photo_url", () => {
    expect(
      branchAssetSchema.safeParse({
        ...base,
        description: "Commercial grade",
        photo_url: "https://example.com/machine.jpg",
      }).success,
    ).toBe(true);
    expect(
      branchAssetSchema.safeParse({
        ...base,
        description: "",
        photo_url: "",
      }).success,
    ).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = branchAssetSchema.safeParse({
      title: "",
      quantity: 1,
      price_amount: 1000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative quantity", () => {
    const result = branchAssetSchema.safeParse({
      title: "Chair",
      quantity: -1,
      price_amount: 1000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative price_amount", () => {
    const result = branchAssetSchema.safeParse({
      title: "Chair",
      quantity: 1,
      price_amount: -100,
    });
    expect(result.success).toBe(false);
  });
});

describe("branchAssetFormToPayload", () => {
  it("maps form values to API payload with quantity as string", () => {
    const payload = branchAssetFormToPayload({
      title: "  Table  ",
      description: "Round table",
      quantity: 4,
      price_amount: 2_500_000,
      photo_url: "https://example.com/table.jpg",
    });

    expect(payload).toEqual({
      title: "Table",
      description: "Round table",
      quantity: "4",
      price_amount: 2_500_000,
      photo_url: "https://example.com/table.jpg",
    });
  });

  it("sends empty photo_url when cleared", () => {
    const payload = branchAssetFormToPayload({
      title: "Chair",
      description: "",
      quantity: 10,
      price_amount: 150_000,
      photo_url: "",
    });

    expect(payload.photo_url).toBe("");
    expect(payload).not.toHaveProperty("description");
  });
});

describe("branchAssetsAdminApi", () => {
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

    await listBranchAssets({
      page: 2,
      perPage: 10,
      search: "table",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/api/admin/branch-assets?page=2&per_page=10&search=table",
    );
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
  });

  it("unwraps envelope responses for get, create, update, and delete", async () => {
    const asset = {
      id: "ba-1",
      title: "Espresso machine",
      description: null,
      photo_url: null,
      quantity: "2",
      price_amount: 15_000_000,
      line_value: 30_000_000,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (method === "GET" && url.endsWith("/api/admin/branch-assets/ba-1")) {
          return jsonResponse({ success: true, data: asset });
        }
        if (method === "POST" && url.endsWith("/api/admin/branch-assets")) {
          return jsonResponse({ success: true, data: asset });
        }
        if (method === "PUT" && url.endsWith("/api/admin/branch-assets/ba-1")) {
          return jsonResponse({ success: true, data: asset });
        }
        if (
          method === "DELETE" &&
          url.endsWith("/api/admin/branch-assets/ba-1")
        ) {
          return new Response(null, { status: 204 });
        }
        return jsonResponse({ success: false }, 404);
      },
    );

    const got = await branchAssetsAdminApi.get("ba-1");
    expect(got.data.quantity).toBe(2);
    expect(got.data.price_amount).toBe(15_000_000);
    expect(got.data.line_value).toBe(30_000_000);

    const created = await branchAssetsAdminApi.create({
      title: "Espresso machine",
      quantity: "2",
      price_amount: 15_000_000,
      photo_url: "",
    });
    expect(created.data?.title).toBe("Espresso machine");

    const updated = await branchAssetsAdminApi.update("ba-1", {
      title: "Espresso machine",
      quantity: "2",
      price_amount: 15_000_000,
      photo_url: "",
    });
    expect(updated.data?.title).toBe("Espresso machine");

    await branchAssetsAdminApi.delete("ba-1");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("normalizes string numeric fields from list API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          {
            id: "ba-1",
            title: "Chair",
            description: null,
            photo_url: null,
            quantity: "10",
            price_amount: "150000",
            line_value: "1500000",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        meta: { page: 1, per_page: 10, total: 1 },
      }),
    );

    const result = await branchAssetsAdminApi.list();
    expect(result.data[0]?.quantity).toBe(10);
    expect(result.data[0]?.price_amount).toBe(150_000);
    expect(result.data[0]?.line_value).toBe(1_500_000);
  });
});

describe("normalizeBranchAsset", () => {
  it("coerces string numeric fields to numbers", () => {
    const normalized = normalizeBranchAsset({
      id: "ba-1",
      title: "Table",
      quantity: "2.5",
      price_amount: "1000000",
      line_value: "2500000",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(normalized.quantity).toBe(2.5);
    expect(normalized.price_amount).toBe(1_000_000);
    expect(normalized.line_value).toBe(2_500_000);
  });
});
