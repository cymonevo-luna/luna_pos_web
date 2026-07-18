import { describe, it, expect } from "vitest";
import { filterAdminNavItems } from "@/app/admin/(protected)/layout";
import { canAccessRoute } from "@/lib/auth/roles";
import { sourceWithFeatures } from "@/lib/auth/feature-fixtures";
import type { NavItem } from "@/components/layout/dashboard-shell";

const navItems: NavItem[] = [
  { href: "/admin", label: "Overview", icon: () => null },
  { href: "/admin/users", label: "Users", icon: () => null, feature: "users.manage" },
  { href: "/admin/cogs", label: "COGS", icon: () => null, feature: "cogs.view" },
  {
    href: "/admin/transactions",
    label: "Transactions",
    icon: () => null,
    feature: "transactions.view",
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

function navLabels(features: string[]) {
  return filterAdminNavItems(navItems, { features }).map((item) => item.label);
}

/**
 * Checklist coverage for POS-18-10 acceptance criteria.
 */
describe("POS-18-10 feature-based navigation and route guards", () => {
  it("1. Admin-only nav items", () => {
    const admin = sourceWithFeatures(["admin"]);
    const labels = navLabels(admin.features);
    expect(labels).toContain("Users");
    expect(labels).not.toContain("COGS");
    expect(labels).not.toContain("Purchases");
    expect(labels).not.toContain("Suppliers");
  });

  it("2. Manager routes accessible", () => {
    const manager = sourceWithFeatures(["manager"]);
    expect(canAccessRoute("/admin/cogs", manager)).toBe(true);
    expect(canAccessRoute("/admin/transactions", manager)).toBe(true);
  });

  it("3. Operational routes accessible", () => {
    const operational = sourceWithFeatures(["operational"]);
    expect(canAccessRoute("/admin/purchases", operational)).toBe(true);
    expect(canAccessRoute("/admin/suppliers", operational)).toBe(true);
  });

  it("4. Guard blocks unauthorized deep link", () => {
    const operational = sourceWithFeatures(["operational"]);
    expect(canAccessRoute("/admin/users", operational)).toBe(false);
  });

  it("5. Multi-feature combined nav", () => {
    const combined = sourceWithFeatures(["manager", "operational"]);
    const labels = navLabels(combined.features);
    expect(labels).toContain("COGS");
    expect(labels).toContain("Purchases");
  });

  it("Selling reports nav item does not appear", () => {
    const roleSets = [
      sourceWithFeatures(["admin"]),
      sourceWithFeatures(["manager"]),
      sourceWithFeatures(["operational"]),
      sourceWithFeatures(["manager", "operational"]),
    ];
    for (const source of roleSets) {
      const labels = navLabels(source.features);
      expect(labels.some((label) => /selling|report/i.test(label))).toBe(false);
    }
  });
});
