export type TestAccountRole = "admin" | "manager" | "cashier" | "operational";

export interface TestAccount {
  readonly email: string;
  readonly password: string;
  readonly role: TestAccountRole;
}

const DEFAULT_TEST_ACCOUNTS = {
  admin: {
    email: "admin-test@cymonevo.com",
    password: "LunaTesting123!",
    role: "admin",
  },
  manager: {
    email: "manager-test@cymonevo.com",
    password: "LunaTesting123!",
    role: "manager",
  },
  cashier: {
    email: "cashier-test@cymonevo.com",
    password: "LunaTesting123!",
    role: "cashier",
  },
  operational: {
    email: "operation-test@cymonevo.com",
    password: "LunaTesting123!",
    role: "operational",
  },
} as const satisfies Record<TestAccountRole, TestAccount>;

function envOverride(
  role: TestAccountRole,
  field: "email" | "password",
  fallback: string,
): string {
  const key = `TEST_${role.toUpperCase()}_${field.toUpperCase()}`;
  return process.env[key] ?? fallback;
}

function buildAccount(role: TestAccountRole): TestAccount {
  const defaults = DEFAULT_TEST_ACCOUNTS[role];
  return {
    email: envOverride(role, "email", defaults.email),
    password: envOverride(role, "password", defaults.password),
    role: defaults.role,
  };
}

/** Seeded dedicated accounts from luna_pos_service — do not register new users in automated flows. */
export const TEST_ACCOUNTS: Record<TestAccountRole, TestAccount> = {
  admin: buildAccount("admin"),
  manager: buildAccount("manager"),
  cashier: buildAccount("cashier"),
  operational: buildAccount("operational"),
};
