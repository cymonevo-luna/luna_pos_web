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

/**
 * Live API verification for POS-142-4. Requires luna_pos_service with cook support.
 * Set RUN_INTEGRATION_TESTS=1 and NEXT_PUBLIC_API_URL=http://localhost:8087.
 */
describe("POS-142-4 cook admin flows (live API)", () => {
  let originalCookFeatures: string[] = [];
  let createdUserId: string | null = null;

  beforeAll(async () => {
    if (process.env.RUN_INTEGRATION_TESTS !== "1") {
      return;
    }

    await assertApiReachable();
    tokenStore.clear();
    await loginAsTestAccount("admin");

    const mappings = await getRoleFeatures();
    const cookMapping = mappings.data?.find((entry) => entry.role === "cook");
    originalCookFeatures = [...(cookMapping?.features ?? [])];
  });

  afterAll(async () => {
    if (process.env.RUN_INTEGRATION_TESTS !== "1") {
      return;
    }

    tokenStore.clear();
    await loginAsTestAccount("admin");

    if (createdUserId) {
      try {
        await adminApi.deleteUser(createdUserId);
      } catch {
        // Best-effort cleanup for integration runs.
      }
    }

    try {
      await updateRoleFeatures("cook", originalCookFeatures);
    } catch {
      // Best-effort cleanup for integration runs.
    }
  });

  it("1. API health check", async () => {
    if (process.env.RUN_INTEGRATION_TESTS !== "1") {
      return;
    }

    await assertApiReachable();
  });

  it("2. role-features includes cook alongside existing roles", async () => {
    if (process.env.RUN_INTEGRATION_TESTS !== "1") {
      return;
    }

    const result = await getRoleFeatures();
    const roles = result.data?.map((entry) => entry.role) ?? [];

    expect(roles).toEqual(expect.arrayContaining(ASSIGNABLE_ROLES));
    expect(result.data?.some((entry) => entry.role === "cook")).toBe(true);
  });

  it("3. cook privileges save and persist after reload", async () => {
    if (process.env.RUN_INTEGRATION_TESTS !== "1") {
      return;
    }

    const updated = await updateRoleFeatures("cook", [
      "production_requests.view",
    ]);
    expect(updated.data?.role).toBe("cook");
    expect(updated.data?.features).toContain("production_requests.view");

    const reloaded = await getRoleFeatures();
    const cookMapping = reloaded.data?.find((entry) => entry.role === "cook");
    expect(cookMapping?.features ?? []).toContain("production_requests.view");
  });

  it("4. create cook-only user and read back roles", async () => {
    if (process.env.RUN_INTEGRATION_TESTS !== "1") {
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
    expect(created.data.roles).toContain("cook");

    const fetched = await adminApi.getUser(created.data.id);
    expect(fetched.data.roles).toEqual(["cook"]);
  });

  it("5. existing role mappings remain available", async () => {
    if (process.env.RUN_INTEGRATION_TESTS !== "1") {
      return;
    }

    const result = await getRoleFeatures();
    const roles = new Set(result.data?.map((entry) => entry.role));

    for (const role of ["admin", "manager", "cashier", "operational"] as const) {
      expect(roles.has(role)).toBe(true);
    }
  });
});
