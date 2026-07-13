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
 * Live API verification for POS-53-2. Requires luna_pos_service with menus that
 * have ingredient formulas. Set RUN_INTEGRATION_TESTS=1 and point
 * NEXT_PUBLIC_API_URL at the API (local :8087 or production).
 */
describe("POS-53-2 production request single-item estimate (live API)", () => {
  beforeAll(async () => {
    if (process.env.RUN_INTEGRATION_TESTS === "1") {
      await assertApiReachable();
    }
  });

  it("returns a valid estimate envelope for a single menu line", async () => {
    if (process.env.RUN_INTEGRATION_TESTS !== "1") {
      return;
    }

    tokenStore.clear();
    await loginAsTestAccount("manager");

    const menus = await menusAdminApi.list({ page: 1, perPage: 20 });
    const menu = menus.data[0];
    expect(menu).toBeDefined();

    const result = await productionRequestsAdminApi.estimate({
      items: [{ menu_id: menu!.id, quantity: 5 }],
    });

    expect(typeof result.data.is_fully_producible).toBe("boolean");
    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0]?.menu_id).toBe(menu!.id);
    expect(result.data.items[0]?.quantity).toBe(5);
    expect(Array.isArray(result.data.aggregated_ingredients)).toBe(true);
  });
});
