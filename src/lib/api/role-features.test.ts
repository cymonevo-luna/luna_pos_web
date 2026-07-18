import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getRoleFeatures,
  listFeatures,
  updateRoleFeatures,
} from "./role-features";
import { tokenStore } from "@/lib/auth/tokens";
import type { Feature, RoleFeatureMapping } from "./types";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const sampleFeatures: Feature[] = [
  {
    key: "cogs",
    name: "COGS",
    description: "View and manage cost of goods sold",
    category: "admin",
    sort_order: 10,
  },
  {
    key: "pos.checkout",
    name: "POS Checkout",
    category: "pos",
    sort_order: 20,
  },
];

const sampleMappings: RoleFeatureMapping[] = [
  { role: "admin", features: ["cogs", "role_features.manage", "users.manage"] },
  { role: "manager", features: ["cogs"] },
  { role: "cashier", features: ["pos.checkout"] },
  { role: "operational", features: [] },
];

describe("role-features API", () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists features from the admin features endpoint", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: sampleFeatures,
      }),
    );

    const result = await listFeatures();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8080/api/admin/features");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
    expect(result.data).toEqual(sampleFeatures);
  });

  it("loads role feature mappings", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: sampleMappings,
      }),
    );

    const result = await getRoleFeatures();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/admin/role-features",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.data).toEqual(sampleMappings);
  });

  it("updates role features with a PUT payload", async () => {
    tokenStore.set("token-abc", "refresh-abc");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: { role: "manager", features: [] },
      }),
    );

    await updateRoleFeatures("manager", []);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/admin/role-features/manager",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ features: [] }),
      }),
    );
  });
});
