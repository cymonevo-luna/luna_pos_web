import { beforeAll, describe, expect, it } from "vitest";
import { config } from "@/lib/config";
import { menusAdminApi } from "@/lib/api/menus";
import { productionRequestsAdminApi } from "@/lib/api/production-requests";
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

/**
 * Live API verification for POS-49-3. Requires luna_pos_service with the
 * production request list schema fix deployed. Set RUN_INTEGRATION_TESTS=1 and
 * point NEXT_PUBLIC_API_URL at the API (local :8087 or production).
 */
describe("POS-49-3 production requests admin list (live API)", () => {
  beforeAll(async () => {
    if (process.env.RUN_INTEGRATION_TESTS === "1") {
      await assertApiReachable();
    }
  });

  it("1. Production list endpoint returns 200 with paginated envelope", async () => {
    if (process.env.RUN_INTEGRATION_TESTS !== "1") {
      return;
    }

    tokenStore.clear();
    await loginAsTestAccount("operational");

    const result = await productionRequestsAdminApi.list({
      page: 1,
      perPage: 10,
    });

    expect(Array.isArray(result.data)).toBe(true);
    expect(result.meta).toMatchObject({
      page: 1,
      per_page: 10,
    });
    expect(typeof result.meta?.total).toBe("number");
  });

  it("2. List rows expose status and item_count for operational users", async () => {
    if (process.env.RUN_INTEGRATION_TESTS !== "1") {
      return;
    }

    tokenStore.clear();
    await loginAsTestAccount("operational");

    const result = await productionRequestsAdminApi.list({
      page: 1,
      perPage: 10,
    });

    for (const row of result.data) {
      expect(row.id).toEqual(expect.any(String));
      expect(row.status).toEqual(
        expect.stringMatching(/^(REQUESTED|ACCEPTED|READY_TO_PICK|DONE)$/),
      );
      expect(typeof row.item_count).toBe("number");
      expect(typeof row.is_fully_producible).toBe("boolean");
    }
  });

  it("3. Created production request appears in list with item_count", async () => {
    if (process.env.RUN_INTEGRATION_TESTS !== "1") {
      return;
    }

    tokenStore.clear();
    await loginAsTestAccount("manager");

    const menus = await menusAdminApi.list({ page: 1, perPage: 1 });
    const menu = menus.data[0];
    expect(menu).toBeDefined();

    const created = await productionRequestsAdminApi.create({
      items: [{ menu_id: menu!.id, quantity: 1 }],
    });

    tokenStore.clear();
    await loginAsTestAccount("operational");

    const list = await productionRequestsAdminApi.list({ page: 1, perPage: 50 });
    const match = list.data.find((item) => item.id === created.data.id);
    expect(match).toBeDefined();
    expect(match?.status).toBe("REQUESTED");
    expect(match?.item_count).toBeGreaterThanOrEqual(1);
  });
});
