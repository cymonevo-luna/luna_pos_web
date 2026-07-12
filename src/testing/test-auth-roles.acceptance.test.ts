import { describe, expect, it } from "vitest";
import { TEST_ACCOUNTS, type TestAccountRole } from "@/testing/accounts";
import { getTestLoginPath } from "@/testing/auth";

/**
 * POS-20-2 acceptance: role-to-account mapping for Tester Agent and E2E flows.
 * Authenticate via login only — never register per run.
 */
describe("POS-20-2 dedicated test account role mapping", () => {
  const scenarios: {
    role: TestAccountRole;
    email: string;
    loginPath: string;
    scope: string;
  }[] = [
    {
      role: "admin",
      email: "admin-test@cymonevo.com",
      loginPath: "/admin/login",
      scope: "Admin dashboard / user management",
    },
    {
      role: "manager",
      email: "manager-test@cymonevo.com",
      loginPath: "/admin/login",
      scope: "Manager workflows",
    },
    {
      role: "cashier",
      email: "cashier-test@cymonevo.com",
      loginPath: "/login",
      scope: "POS / cashier flows",
    },
    {
      role: "operational",
      email: "operation-test@cymonevo.com",
      loginPath: "/admin/login",
      scope: "Operations / inventory / supply",
    },
  ];

  it.each(scenarios)(
    "$scope uses $email at $loginPath",
    ({ role, email, loginPath }) => {
      expect(TEST_ACCOUNTS[role].email).toBe(email);
      expect(TEST_ACCOUNTS[role].password).toBe("LunaTesting123!");
      expect(TEST_ACCOUNTS[role].role).toBe(role);
      expect(getTestLoginPath(role)).toBe(loginPath);
    },
  );

  it("exposes exactly four seeded accounts (no dynamic registration)", () => {
    expect(Object.keys(TEST_ACCOUNTS)).toHaveLength(4);
    for (const account of Object.values(TEST_ACCOUNTS)) {
      expect(account.email).toMatch(/-test@cymonevo\.com$/);
    }
  });
});
