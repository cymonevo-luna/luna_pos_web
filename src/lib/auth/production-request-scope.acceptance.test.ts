import { describe, it, expect } from "vitest";
import { filterAdminNavItems } from "@/app/admin/(protected)/layout";
import { canAccessRoute } from "@/lib/auth/roles";
import { sourceWithFeatures } from "@/lib/auth/feature-fixtures";
import type { NavItem } from "@/components/layout/dashboard-shell";

const navItems: NavItem[] = [
  { href: "/admin", label: "Overview", icon: () => null },
  {
    href: "/admin/production-requests",
    label: "Production",
    icon: () => null,
    feature: "production_requests.view",
  },
];

/**
 * Checklist coverage for POS-39-7 and POS-45-2 acceptance criteria.
 */
describe("POS-39-7 production request route guards and navigation", () => {
  it("1. Operational nav includes production", () => {
    const operational = sourceWithFeatures(["operational"]);
    expect(canAccessRoute("/admin/production-requests", operational)).toBe(true);
    expect(
      canAccessRoute("/admin/production-requests/prod-1", operational),
    ).toBe(true);

    const labels = filterAdminNavItems(navItems, operational).map(
      (item) => item.label,
    );
    expect(labels).toContain("Production");
    expect(labels).not.toContain("New production request");
  });

  it("2. Manager can access production list and detail routes", () => {
    const manager = sourceWithFeatures(["manager"]);
    expect(canAccessRoute("/admin/production-requests", manager)).toBe(true);
    expect(
      canAccessRoute("/admin/production-requests/prod-1", manager),
    ).toBe(true);
    expect(canAccessRoute("/admin/production-requests/new", manager)).toBe(true);

    const labels = filterAdminNavItems(navItems, manager).map(
      (item) => item.label,
    );
    expect(labels).toContain("Production");
    expect(labels).not.toContain("New production request");
  });

  it("3. Cashier blocked from admin production routes", () => {
    const cashier = sourceWithFeatures(["cashier"]);
    expect(canAccessRoute("/admin/production-requests", cashier)).toBe(false);
    expect(canAccessRoute("/admin/production-requests/new", cashier)).toBe(false);
    expect(
      canAccessRoute("/admin/production-requests/prod-1", cashier),
    ).toBe(false);

    const labels = filterAdminNavItems(navItems, cashier).map(
      (item) => item.label,
    );
    expect(labels).not.toContain("Production");
    expect(labels).not.toContain("New production request");
  });

  it("4. Operational blocked from manager create route", () => {
    const operational = sourceWithFeatures(["operational"]);
    expect(
      canAccessRoute("/admin/production-requests/new", operational),
    ).toBe(false);
  });

  it("5. Admin can access production list and detail, blocked from create", () => {
    const admin = sourceWithFeatures(["admin"]);
    expect(canAccessRoute("/admin/production-requests", admin)).toBe(true);
    expect(
      canAccessRoute("/admin/production-requests/prod-1", admin),
    ).toBe(true);
    expect(canAccessRoute("/admin/production-requests/new", admin)).toBe(false);

    const labels = filterAdminNavItems(navItems, admin).map(
      (item) => item.label,
    );
    expect(labels).toContain("Production");
    expect(labels).not.toContain("New production request");
  });
});
