import { beforeAll, describe, expect, it } from "vitest";
import { config } from "@/lib/config";
import {
  supplierFormToPayload,
  suppliersAdminApi,
} from "@/lib/api/suppliers";
import { foodSuppliesAdminApi } from "@/lib/api/food-supplies";
import { purchaseRequestsAdminApi } from "@/lib/api/purchase-requests";
import { loginAsTestAccount } from "@/testing/auth";
import { tokenStore } from "@/lib/auth/tokens";

async function assertApiReachable(): Promise<void> {
  try {
    const res = await fetch(`${config.apiBaseUrl}/healthz`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      throw new Error(
        `API health check failed at ${config.apiBaseUrl}/healthz (HTTP ${res.status}). ` +
          "Start luna_pos_service with `make docker-up` in the sibling repo.",
      );
    }
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "unknown connection error";
    throw new Error(
      `API unreachable at ${config.apiBaseUrl}/healthz: ${detail}. ` +
        "Start luna_pos_service with `make docker-up` in the sibling repo.",
    );
  }
}

function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}`;
}

/**
 * Live API verification for POS-29-2. Requires luna_pos_service with the
 * suppliers list schema fix deployed. Set RUN_INTEGRATION_TESTS=1 and point
 * NEXT_PUBLIC_API_URL at the API (local :8087 or production).
 */
describe("POS-29-2 supplier admin list (live API)", () => {
  beforeAll(async () => {
    if (process.env.RUN_INTEGRATION_TESTS === "1") {
      await assertApiReachable();
    }
  });

  it("1. Supplier list endpoint returns 200 with success envelope", async () => {
    if (process.env.RUN_INTEGRATION_TESTS !== "1") {
      return;
    }

    tokenStore.clear();
    await loginAsTestAccount("operational");

    const result = await suppliersAdminApi.list({ page: 1, perPage: 10 });
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.meta).toMatchObject({
      page: 1,
      per_page: 10,
    });
    expect(typeof result.meta?.total).toBe("number");
  });

  it("2. Created supplier appears in list with price_quotes_count", async () => {
    if (process.env.RUN_INTEGRATION_TESTS !== "1") {
      return;
    }

    tokenStore.clear();
    await loginAsTestAccount("operational");

    const name = uniqueName("POS-29-2 Supplier");
    const created = await suppliersAdminApi.create(
      supplierFormToPayload({
        name,
        phone_number: "08123456789",
        address: "Jl Test Address",
        supports_delivery: false,
      }),
    );

    const list = await suppliersAdminApi.list({ search: name, perPage: 10 });
    const match = list.data.find((item) => item.id === created.data.id);
    expect(match).toBeDefined();
    expect(match?.name).toBe(name);
    expect(match?.phone_number).toBe("08123456789");
    expect(match?.address).toBe("Jl Test Address");
    expect(typeof match?.price_quotes_count).toBe("number");
  });

  it("3. Pagination returns distinct pages when total exceeds per_page", async () => {
    if (process.env.RUN_INTEGRATION_TESTS !== "1") {
      return;
    }

    tokenStore.clear();
    await loginAsTestAccount("operational");

    const prefix = uniqueName("POS-29-2 Page");
    for (let index = 0; index < 11; index += 1) {
      await suppliersAdminApi.create(
        supplierFormToPayload({
          name: `${prefix} ${index}`,
          phone_number: "08123456789",
          address: "Jl Pagination Test",
          supports_delivery: false,
        }),
      );
    }

    const page1 = await suppliersAdminApi.list({
      page: 1,
      perPage: 10,
      search: prefix,
    });
    const page2 = await suppliersAdminApi.list({
      page: 2,
      perPage: 10,
      search: prefix,
    });

    expect(page1.meta?.total).toBeGreaterThanOrEqual(11);
    expect(page1.data).toHaveLength(10);
    expect(page2.data.length).toBeGreaterThanOrEqual(1);

    const page1Ids = new Set(page1.data.map((item) => item.id));
    for (const item of page2.data) {
      expect(page1Ids.has(item.id)).toBe(false);
    }
  });

  it("4. Food supplies and purchase requests list endpoints still succeed", async () => {
    if (process.env.RUN_INTEGRATION_TESTS !== "1") {
      return;
    }

    tokenStore.clear();
    await loginAsTestAccount("operational");

    const foodSupplies = await foodSuppliesAdminApi.list({
      page: 1,
      perPage: 10,
    });
    expect(Array.isArray(foodSupplies.data)).toBe(true);

    const purchases = await purchaseRequestsAdminApi.list({
      page: 1,
      perPage: 10,
    });
    expect(Array.isArray(purchases.data)).toBe(true);
  });
});
