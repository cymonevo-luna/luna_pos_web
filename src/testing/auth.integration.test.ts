import { beforeAll, describe, expect, it } from "vitest";
import { config } from "@/lib/config";
import { TEST_ACCOUNTS, type TestAccountRole } from "@/testing/accounts";
import { loginAsTestAccount } from "@/testing/auth";

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
 * Live API verification for POS-20-2. Requires luna_pos_service with migrations applied.
 * Set RUN_INTEGRATION_TESTS=1 and ensure NEXT_PUBLIC_API_URL points at the API.
 */
describe("POS-20-2 dedicated test account login (live API)", () => {
  beforeAll(async () => {
    if (process.env.RUN_INTEGRATION_TESTS === "1") {
      await assertApiReachable();
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

    const result = await loginAsTestAccount(role, { persistSession: false });
    const account = TEST_ACCOUNTS[role];

    expect(result.tokens.access_token).toBeTruthy();
    expect(result.user.email).toBe(account.email);
    expect(result.user.roles).toContain(role);
  });
});
