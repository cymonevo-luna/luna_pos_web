import { beforeAll, describe, expect, it } from "vitest";
import { productionNextDayInsight } from "@/lib/api/insights";
import { config } from "@/lib/config";
import { loginAsTestAccount } from "@/testing/auth";

async function assertApiReachable(): Promise<void> {
  const res = await fetch(`${config.apiBaseUrl}/healthz`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(
      `API health check failed at ${config.apiBaseUrl}/healthz (HTTP ${res.status}).`,
    );
  }
}

/**
 * Live API verification for POS-54-2. Requires luna_pos_service with seeded menus
 * (see scripts/seed-production-insight-qa.sh when menus array is empty).
 */
describe("POS-54-2 production next-day insight (live API)", () => {
  beforeAll(async () => {
    if (process.env.RUN_INTEGRATION_TESTS === "1") {
      await assertApiReachable();
      await loginAsTestAccount("manager", { persistSession: true });
    }
  });

  it("returns backend menus shape and normalizes to UI items", async () => {
    if (process.env.RUN_INTEGRATION_TESTS !== "1") {
      return;
    }

    const { tokens } = await loginAsTestAccount("manager", {
      persistSession: true,
    });
    const rawRes = await fetch(
      `${config.apiBaseUrl}/api/admin/insights/production/next-day?lookback_days=14`,
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      },
    );
    expect(rawRes.status).toBe(200);
    const rawJson = (await rawRes.json()) as {
      success: boolean;
      data?: { menus?: unknown[] };
    };
    expect(rawJson.success).toBe(true);
    expect(Array.isArray(rawJson.data?.menus)).toBe(true);

    const got = await productionNextDayInsight({ lookbackDays: 14 });
    expect(got.data?.generated_at).toBeTruthy();
    expect(Array.isArray(got.data?.items)).toBe(true);

    if ((got.data?.items.length ?? 0) === 0) {
      return;
    }

    for (const item of got.data!.items) {
      expect(item.menu_id).toBeTruthy();
      expect(item.menu_title).toBeTruthy();
      expect(Number.isFinite(item.current_stock)).toBe(true);
      expect(Number.isFinite(item.avg_daily_sales)).toBe(true);
      expect(Number.isFinite(item.projected_demand)).toBe(true);
      expect(Number.isFinite(item.recommended_production_qty)).toBe(true);
      expect(String(item.current_stock)).not.toMatch(/undefined|NaN/i);
      expect(String(item.recommended_production_qty)).not.toMatch(/undefined|NaN/i);
    }

    const limited = got.data!.items.filter((row) => row.limited_by_ingredients);
    if (limited.length > 0) {
      const rawLimited = (rawJson.data?.menus ?? []).find(
        (m) =>
          typeof m === "object" &&
          m !== null &&
          (m as { is_limited_by_ingredients?: boolean })
            .is_limited_by_ingredients === true,
      ) as
        | {
            recommended_production_qty: number;
            max_producible_from_ingredients: number | null;
          }
        | undefined;
      expect(rawLimited).toBeTruthy();
      expect(limited[0]!.recommended_production_qty).toBe(
        rawLimited!.recommended_production_qty,
      );
      expect(limited[0]!.max_producible).toBe(
        rawLimited!.max_producible_from_ingredients,
      );
    }
  });
});
