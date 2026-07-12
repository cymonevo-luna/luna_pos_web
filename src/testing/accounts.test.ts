import { afterEach, describe, expect, it, vi } from "vitest";
import { TEST_ACCOUNTS } from "@/testing/accounts";

describe("TEST_ACCOUNTS", () => {
  const envKeys = [
    "TEST_ADMIN_EMAIL",
    "TEST_ADMIN_PASSWORD",
    "TEST_MANAGER_EMAIL",
    "TEST_MANAGER_PASSWORD",
    "TEST_CASHIER_EMAIL",
    "TEST_CASHIER_PASSWORD",
    "TEST_OPERATIONAL_EMAIL",
    "TEST_OPERATIONAL_PASSWORD",
  ] as const;

  afterEach(() => {
    for (const key of envKeys) {
      delete process.env[key];
    }
    vi.resetModules();
  });

  it("defaults to seeded dedicated testing accounts", async () => {
    vi.resetModules();
    const { TEST_ACCOUNTS: accounts } = await import("@/testing/accounts");

    expect(accounts.admin).toEqual({
      email: "admin-test@cymonevo.com",
      password: "LunaTesting123!",
      role: "admin",
    });
    expect(accounts.manager).toEqual({
      email: "manager-test@cymonevo.com",
      password: "LunaTesting123!",
      role: "manager",
    });
    expect(accounts.cashier).toEqual({
      email: "cashier-test@cymonevo.com",
      password: "LunaTesting123!",
      role: "cashier",
    });
    expect(accounts.operational).toEqual({
      email: "operation-test@cymonevo.com",
      password: "LunaTesting123!",
      role: "operational",
    });
  });

  it("allows email and password overrides via env vars", async () => {
    process.env.TEST_ADMIN_EMAIL = "custom-admin@example.com";
    process.env.TEST_ADMIN_PASSWORD = "CustomPass123!";
    vi.resetModules();
    const { TEST_ACCOUNTS: accounts } = await import("@/testing/accounts");

    expect(accounts.admin.email).toBe("custom-admin@example.com");
    expect(accounts.admin.password).toBe("CustomPass123!");
    expect(accounts.manager.email).toBe("manager-test@cymonevo.com");
  });

  it("exposes stable role keys for scenario mapping", () => {
    expect(Object.keys(TEST_ACCOUNTS).sort()).toEqual([
      "admin",
      "cashier",
      "manager",
      "operational",
    ]);
  });
});
