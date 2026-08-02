import { describe, it, expect } from "vitest";
import { filterAdminNavItems } from "@/app/admin/(protected)/layout";
import { canAccessRoute } from "@/lib/auth/roles";
import { sourceWithFeatures } from "@/lib/auth/feature-fixtures";
import type { NavItem } from "@/components/layout/dashboard-shell";

const qrisBalanceNavItem: NavItem = {
  href: "/admin/qris-balance",
  label: "QRIS Balance",
  icon: () => null,
  feature: "qris_balance.manage",
};

/**
 * Checklist coverage for POS-182-5 acceptance criteria.
 */
describe("POS-182-5 QRIS balance page guards", () => {
  it("1. Manager sees QRIS Balance navigation and page", () => {
    const manager = sourceWithFeatures(["manager"]);
    expect(canAccessRoute("/admin/qris-balance", manager)).toBe(true);

    const labels = filterAdminNavItems([qrisBalanceNavItem], manager).map(
      (item) => item.label,
    );
    expect(labels).toContain("QRIS Balance");
  });

  it("2. Operational user can access QRIS balance page", () => {
    const operational = sourceWithFeatures(["operational"]);
    expect(canAccessRoute("/admin/qris-balance", operational)).toBe(true);

    const labels = filterAdminNavItems([qrisBalanceNavItem], operational).map(
      (item) => item.label,
    );
    expect(labels).toContain("QRIS Balance");
  });

  it("3. Cashier cannot access QRIS balance page", () => {
    const cashier = sourceWithFeatures(["cashier"]);
    expect(canAccessRoute("/admin/qris-balance", cashier)).toBe(false);

    const labels = filterAdminNavItems([qrisBalanceNavItem], cashier).map(
      (item) => item.label,
    );
    expect(labels).not.toContain("QRIS Balance");
  });

  it("admin-only user cannot access QRIS balance page", () => {
    const admin = sourceWithFeatures(["admin"]);
    expect(canAccessRoute("/admin/qris-balance", admin)).toBe(false);
    expect(
      filterAdminNavItems([qrisBalanceNavItem], admin).map(
        (item) => item.label,
      ),
    ).not.toContain("QRIS Balance");
  });
});
