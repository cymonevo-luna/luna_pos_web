import { describe, it, expect } from "vitest";
import { filterAdminNavItems } from "@/app/admin/(protected)/layout";
import { canAccessRoute } from "@/lib/auth/roles";
import { sourceWithFeatures } from "@/lib/auth/feature-fixtures";
import type { NavItem } from "@/components/layout/dashboard-shell";

const navItems: NavItem[] = [
  { href: "/admin", label: "Overview", icon: () => null },
  { href: "/admin/users", label: "Users", icon: () => null, feature: "users.manage" },
  {
    href: "/admin/staff",
    label: "Staff",
    icon: () => null,
    feature: "staff.manage",
  },
  {
    href: "/admin/food-supplies",
    label: "Food Supplies",
    icon: () => null,
    feature: "food_supplies.manage",
  },
];

describe("POS-78-6 staff-scoped route guards", () => {
  it("allows admin access to /admin/staff", () => {
    expect(canAccessRoute("/admin/staff", sourceWithFeatures(["admin"]))).toBe(true);
  });

  it("denies manager access to /admin/staff", () => {
    expect(canAccessRoute("/admin/staff", sourceWithFeatures(["manager"]))).toBe(
      false,
    );
  });

  it("denies cashier access to /admin/staff", () => {
    expect(canAccessRoute("/admin/staff", sourceWithFeatures(["cashier"]))).toBe(
      false,
    );
  });

  it("denies operational access to /admin/staff", () => {
    expect(
      canAccessRoute("/admin/staff", sourceWithFeatures(["operational"])),
    ).toBe(false);
  });

  it("shows Staff nav item only for admin feature grants", () => {
    const admin = sourceWithFeatures(["admin"]);
    const adminLabels = filterAdminNavItems(navItems, admin).map(
      (item) => item.label,
    );
    expect(adminLabels).toContain("Staff");
    expect(adminLabels).toContain("Users");

    const managerLabels = filterAdminNavItems(
      navItems,
      sourceWithFeatures(["manager"]),
    ).map((item) => item.label);
    expect(managerLabels).not.toContain("Staff");

    const cashierLabels = filterAdminNavItems(
      navItems,
      sourceWithFeatures(["cashier"]),
    ).map((item) => item.label);
    expect(cashierLabels).not.toContain("Staff");

    const operationalLabels = filterAdminNavItems(
      navItems,
      sourceWithFeatures(["operational"]),
    ).map((item) => item.label);
    expect(operationalLabels).not.toContain("Staff");
  });

  it("allows admin with multiple roles to access /admin/staff", () => {
    const combined = sourceWithFeatures(["admin", "manager"]);
    expect(canAccessRoute("/admin/staff", combined)).toBe(true);

    const labels = filterAdminNavItems(navItems, combined).map(
      (item) => item.label,
    );
    expect(labels).toContain("Staff");
  });
});
