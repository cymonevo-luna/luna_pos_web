import { beforeAll, describe, expect, it } from "vitest";
import { config } from "@/lib/config";
import { TEST_ACCOUNTS, type TestAccountRole } from "@/testing/accounts";
import { loginAsTestAccount } from "@/testing/auth";

async function isApiReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${config.apiBaseUrl}/healthz`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Live API verification for POS-20-2. Requires luna_pos_service with migrations applied.
 * Set RUN_INTEGRATION_TESTS=1 and ensure NEXT_PUBLIC_API_URL points at the API.
 */
describe("POS-20-2 dedicated test account login (live API)", () => {
  let apiReachable = false;

  beforeAll(async () => {
    if (process.env.RUN_INTEGRATION_TESTS === "1") {
      apiReachable = await isApiReachable();
    }
  });

  const roles: TestAccountRole[] = [
    "admin",
    "manager",
    "cashier",
    "operational",
  ];

  it.each(roles)("logs in as %s with seeded credentials", async (role) => {
    if (process.env.RUN_INTEGRATION_TESTS !== "1") {
      return;
    }
    if (!apiReachable) {
      console.warn(
        `Skipping live login test for ${role}: API not reachable at ${config.apiBaseUrl}`,
      );
      return;
    }

    const result = await loginAsTestAccount(role, { persistSession: false });
    const account = TEST_ACCOUNTS[role];

    expect(result.tokens.access_token).toBeTruthy();
    expect(result.user.email).toBe(account.email);
    expect(result.user.roles).toContain(role);
  });
});
