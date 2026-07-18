import { describe, it, expect } from "vitest";
import { filterAdminNavItems } from "@/app/admin/(protected)/layout";
import { canAccessRoute } from "@/lib/auth/roles";
import { sourceWithFeatures } from "@/lib/auth/feature-fixtures";
import type { NavItem } from "@/components/layout/dashboard-shell";

const navItems: NavItem[] = [
  { href: "/admin", label: "Overview", icon: () => null },
  { href: "/admin/users", label: "Users", icon: () => null, feature: "users.manage" },
  {
    href: "/admin/food-supplies",
    label: "Food Supplies",
    icon: () => null,
    feature: "food_supplies.manage",
  },
  {
    href: "/admin/suppliers",
    label: "Suppliers",
    icon: () => null,
    feature: "suppliers.manage",
  },
  {
    href: "/admin/purchases",
    label: "Purchases",
    icon: () => null,
    feature: "purchases.manage",
  },
];

/**
 * Checklist coverage for POS-18-13 acceptance criteria.
 */
describe("POS-18-13 operational-scoped route guards", () => {
  it("1. Operational accesses suppliers", () => {
    const operational = sourceWithFeatures(["operational"]);
    expect(canAccessRoute("/admin/suppliers", operational)).toBe(true);
    expect(canAccessRoute("/admin/suppliers/new", operational)).toBe(true);
    expect(canAccessRoute("/admin/suppliers/sup-1/edit", operational)).toBe(
      true,
    );

    const labels = filterAdminNavItems(navItems, operational).map(
      (item) => item.label,
    );
    expect(labels).toContain("Suppliers");
  });

  it("2. Operational manages purchase requests", () => {
    const operational = sourceWithFeatures(["operational"]);
    expect(canAccessRoute("/admin/purchases", operational)).toBe(true);
    expect(canAccessRoute("/admin/purchases/new", operational)).toBe(true);
    expect(canAccessRoute("/admin/purchases/pr-1", operational)).toBe(true);

    const labels = filterAdminNavItems(navItems, operational).map(
      (item) => item.label,
    );
    expect(labels).toContain("Purchases");
  });

  it("3. Manager-only blocked from purchase requests", () => {
    const manager = sourceWithFeatures(["manager"]);
    expect(canAccessRoute("/admin/purchases", manager)).toBe(false);
    expect(canAccessRoute("/admin/purchases/new", manager)).toBe(false);

    const labels = filterAdminNavItems(navItems, manager).map(
      (item) => item.label,
    );
    expect(labels).not.toContain("Purchases");
    expect(labels).not.toContain("Suppliers");
  });

  it("4. Admin-only blocked from suppliers", () => {
    const admin = sourceWithFeatures(["admin"]);
    expect(canAccessRoute("/admin/suppliers", admin)).toBe(false);
    expect(canAccessRoute("/admin/purchases", admin)).toBe(false);

    const labels = filterAdminNavItems(navItems, admin).map(
      (item) => item.label,
    );
    expect(labels).not.toContain("Suppliers");
    expect(labels).not.toContain("Purchases");
  });

  it("5. Supplier prices workflow — operational can access supplier detail", () => {
    const operational = sourceWithFeatures(["operational"]);
    expect(canAccessRoute("/admin/suppliers/sup-1", operational)).toBe(true);
    expect(canAccessRoute("/admin/food-supplies", operational)).toBe(true);

    const labels = filterAdminNavItems(navItems, operational).map(
      (item) => item.label,
    );
    expect(labels).toContain("Food Supplies");
  });
});
