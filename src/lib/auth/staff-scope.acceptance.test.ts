import { describe, it, expect } from "vitest";
import { filterAdminNavItems } from "@/app/admin/(protected)/layout";
import { canAccessRoute } from "@/lib/auth/roles";
import type { NavItem } from "@/components/layout/dashboard-shell";

const navItems: NavItem[] = [
  { href: "/admin", label: "Overview", icon: () => null },
  { href: "/admin/users", label: "Users", icon: () => null, roles: ["admin"] },
  {
    href: "/admin/staff",
    label: "Staff",
    icon: () => null,
    roles: ["admin"],
  },
  {
    href: "/admin/food-supplies",
    label: "Food Supplies",
    icon: () => null,
    roles: ["manager", "operational"],
  },
];

describe("POS-78-6 staff-scoped route guards", () => {
  it("allows admin access to /admin/staff", () => {
    expect(canAccessRoute("/admin/staff", ["admin"])).toBe(true);
  });

  it("denies manager access to /admin/staff", () => {
    expect(canAccessRoute("/admin/staff", ["manager"])).toBe(false);
  });

  it("denies cashier access to /admin/staff", () => {
    expect(canAccessRoute("/admin/staff", ["cashier"])).toBe(false);
  });

  it("denies operational access to /admin/staff", () => {
    expect(canAccessRoute("/admin/staff", ["operational"])).toBe(false);
  });

  it("shows Staff nav item only for admin role", () => {
    const adminLabels = filterAdminNavItems(navItems, ["admin"]).map(
      (item) => item.label,
    );
    expect(adminLabels).toContain("Staff");
    expect(adminLabels).toContain("Users");

    const managerLabels = filterAdminNavItems(navItems, ["manager"]).map(
      (item) => item.label,
    );
    expect(managerLabels).not.toContain("Staff");

    const cashierLabels = filterAdminNavItems(navItems, ["cashier"]).map(
      (item) => item.label,
    );
    expect(cashierLabels).not.toContain("Staff");

    const operationalLabels = filterAdminNavItems(navItems, ["operational"]).map(
      (item) => item.label,
    );
    expect(operationalLabels).not.toContain("Staff");
  });

  it("allows admin with multiple roles to access /admin/staff", () => {
    expect(canAccessRoute("/admin/staff", ["admin", "manager"])).toBe(true);

    const labels = filterAdminNavItems(navItems, ["admin", "manager"]).map(
      (item) => item.label,
    );
    expect(labels).toContain("Staff");
  });
});
