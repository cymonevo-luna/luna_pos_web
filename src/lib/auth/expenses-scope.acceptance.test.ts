import { describe, it, expect } from "vitest";
import { filterAdminNavItems } from "@/app/admin/(protected)/layout";
import { canAccessRoute } from "@/lib/auth/roles";
import type { NavItem } from "@/components/layout/dashboard-shell";

const expensesNavItem: NavItem = {
  href: "/admin/expenses",
  label: "Expenses",
  icon: () => null,
  roles: ["manager", "operational"],
};

/**
 * Checklist coverage for POS-79-4 acceptance criteria.
 */
describe("POS-79-4 expenses list page guards", () => {
  it("1. Manager sees expenses navigation and list page", () => {
    expect(canAccessRoute("/admin/expenses", ["manager"])).toBe(true);
    expect(canAccessRoute("/admin/expenses/new", ["manager"])).toBe(true);
    expect(canAccessRoute("/admin/expenses/exp-1/edit", ["manager"])).toBe(
      true,
    );

    const labels = filterAdminNavItems([expensesNavItem], ["manager"]).map(
      (item) => item.label,
    );
    expect(labels).toContain("Expenses");
  });

  it("2. Operational user can access expenses list", () => {
    expect(canAccessRoute("/admin/expenses", ["operational"])).toBe(true);
    expect(canAccessRoute("/admin/expenses/new", ["operational"])).toBe(true);
    expect(canAccessRoute("/admin/expenses/exp-1/edit", ["operational"])).toBe(
      true,
    );

    const labels = filterAdminNavItems([expensesNavItem], ["operational"]).map(
      (item) => item.label,
    );
    expect(labels).toContain("Expenses");
  });

  it("3. Cashier cannot access expenses page", () => {
    expect(canAccessRoute("/admin/expenses", ["cashier"])).toBe(false);
    expect(canAccessRoute("/admin/expenses/new", ["cashier"])).toBe(false);

    const labels = filterAdminNavItems([expensesNavItem], ["cashier"]).map(
      (item) => item.label,
    );
    expect(labels).not.toContain("Expenses");
  });

  it("admin-only user cannot access expenses page", () => {
    expect(canAccessRoute("/admin/expenses", ["admin"])).toBe(false);
    expect(
      filterAdminNavItems([expensesNavItem], ["admin"]).map((item) => item.label),
    ).not.toContain("Expenses");
  });
});
