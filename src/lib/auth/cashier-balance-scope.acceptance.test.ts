import { describe, it, expect } from "vitest";
import { filterAdminNavItems } from "@/app/admin/(protected)/layout";
import { canAccessRoute } from "@/lib/auth/roles";
import { sourceWithFeatures } from "@/lib/auth/feature-fixtures";
import type { NavItem } from "@/components/layout/dashboard-shell";

const cashierBalanceNavItem: NavItem = {
  href: "/admin/cashier-balance",
  label: "Cashier Balance",
  icon: () => null,
  feature: "cashier_balance.manage",
};

/**
 * Checklist coverage for POS-114-3 acceptance criteria.
 */
describe("POS-114-3 cashier balance page guards", () => {
  it("1. Manager sees Cashier Balance navigation and page", () => {
    const manager = sourceWithFeatures(["manager"]);
    expect(canAccessRoute("/admin/cashier-balance", manager)).toBe(true);

    const labels = filterAdminNavItems([cashierBalanceNavItem], manager).map(
      (item) => item.label,
    );
    expect(labels).toContain("Cashier Balance");
  });

  it("2. Operational user can access cashier balance page", () => {
    const operational = sourceWithFeatures(["operational"]);
    expect(canAccessRoute("/admin/cashier-balance", operational)).toBe(true);

    const labels = filterAdminNavItems([cashierBalanceNavItem], operational).map(
      (item) => item.label,
    );
    expect(labels).toContain("Cashier Balance");
  });

  it("3. Cashier cannot access cashier balance page", () => {
    const cashier = sourceWithFeatures(["cashier"]);
    expect(canAccessRoute("/admin/cashier-balance", cashier)).toBe(false);

    const labels = filterAdminNavItems([cashierBalanceNavItem], cashier).map(
      (item) => item.label,
    );
    expect(labels).not.toContain("Cashier Balance");
  });

  it("admin-only user cannot access cashier balance page", () => {
    const admin = sourceWithFeatures(["admin"]);
    expect(canAccessRoute("/admin/cashier-balance", admin)).toBe(false);
    expect(
      filterAdminNavItems([cashierBalanceNavItem], admin).map(
        (item) => item.label,
      ),
    ).not.toContain("Cashier Balance");
  });
});
