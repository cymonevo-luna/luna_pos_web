import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "@/lib/config";
import { adminApi } from "@/lib/api/users";
import {
  getRoleFeatures,
  updateRoleFeatures,
} from "@/lib/api/role-features";
import { ASSIGNABLE_ROLES } from "@/lib/auth/roles";
import { tokenStore } from "@/lib/auth/tokens";
import { loginAsTestAccount } from "@/testing/auth";

async function assertApiReachable(): Promise<void> {
  const healthPaths = ["/healthz", "/health"];
  let lastError = "unknown connection error";

  for (const path of healthPaths) {
    try {
      const res = await fetch(`${config.apiBaseUrl}${path}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        return;
      }
      lastError = `HTTP ${res.status} at ${path}`;
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : "unknown connection error";
    }
  }

  throw new Error(
    `API unreachable at ${config.apiBaseUrl} (${lastError}). ` +
      "Start luna_pos_service with `make docker-up` in the sibling repo.",
  );
}

function uniqueCookEmail(): string {
  return `cook-e2e-${Date.now()}@integration.test`;
}

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "1";

let originalCookFeatures: string[] = [];
let createdUserId: string | undefined;

/**
 * Live API verification for POS-143-2 cook admin flows. Requires luna_pos_service
 * with migrations applied and the seeded admin test account.
 * Set RUN_INTEGRATION_TESTS=1 and ensure NEXT_PUBLIC_API_URL points at the API.
 */
describe("POS-143-2 cook admin flows (live API)", () => {
  beforeAll(async () => {
    if (!integrationEnabled) {
      return;
    }

    await assertApiReachable();
    tokenStore.clear();
    await loginAsTestAccount("admin");

    const matrix = await getRoleFeatures();
    const cookEntry = matrix.data.find((mapping) => mapping.role === "cook");
    originalCookFeatures = [...(cookEntry?.features ?? [])];
  });

  afterAll(async () => {
    if (!integrationEnabled) {
      return;
    }

    tokenStore.clear();
    try {
      await loginAsTestAccount("admin");
    } catch {
      // Best-effort cleanup login.
    }

    if (createdUserId) {
      try {
        await adminApi.deleteUser(createdUserId);
      } catch {
        // Best-effort user cleanup.
      }
    }

    try {
      await updateRoleFeatures("cook", originalCookFeatures);
    } catch {
      // Best-effort cook feature restore.
    }
  });

  it("API health check", async () => {
    if (!integrationEnabled) {
      return;
    }

    await expect(assertApiReachable()).resolves.toBeUndefined();
  });

  it("Cook in role-features matrix", async () => {
    if (!integrationEnabled) {
      return;
    }

    const matrix = await getRoleFeatures();
    const roles = matrix.data.map((mapping) => mapping.role);

    expect(roles).toContain("cook");
    for (const role of ASSIGNABLE_ROLES) {
      expect(roles).toContain(role);
    }
  });

  it("Cook privileges save and persist", async () => {
    if (!integrationEnabled) {
      return;
    }

    const result = await updateRoleFeatures("cook", [
      "production_requests.view",
    ]);
    expect(result.data.role).toBe("cook");
    expect(result.data.features).toContain("production_requests.view");

    const matrix = await getRoleFeatures();
    const cookEntry = matrix.data.find((mapping) => mapping.role === "cook");
    expect(cookEntry?.features).toContain("production_requests.view");
  });

  it("Create cook-only user", async () => {
    if (!integrationEnabled) {
      return;
    }

    const email = uniqueCookEmail();
    const created = await adminApi.createUser({
      email,
      name: "Cook E2E",
      password: "LunaTesting123!",
      roles: ["cook"],
    });
    createdUserId = created.data.id;

    expect(created.data.roles).toEqual(["cook"]);

    const fetched = await adminApi.getUser(created.data.id);
    expect(fetched.data.roles).toEqual(["cook"]);
  });

  it("Existing roles regression", async () => {
    if (!integrationEnabled) {
      return;
    }

    const matrix = await getRoleFeatures();
    const roles = matrix.data.map((mapping) => mapping.role);

    for (const role of [
      "admin",
      "manager",
      "cashier",
      "operational",
    ] as const) {
      expect(roles).toContain(role);
    }
  });
});
