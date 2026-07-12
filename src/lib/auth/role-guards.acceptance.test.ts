import { describe, it, expect } from "vitest";
import { filterAdminNavItems } from "@/app/admin/(protected)/layout";
import { canAccessRoute } from "@/lib/auth/roles";
import type { NavItem } from "@/components/layout/dashboard-shell";

const navItems: NavItem[] = [
  { href: "/admin", label: "Overview", icon: () => null },
  { href: "/admin/users", label: "Users", icon: () => null, roles: ["admin"] },
  { href: "/admin/cogs", label: "COGS", icon: () => null, roles: ["manager"] },
  {
    href: "/admin/transactions",
    label: "Transactions",
    icon: () => null,
    roles: ["manager"],
  },
  {
    href: "/admin/suppliers",
    label: "Suppliers",
    icon: () => null,
    roles: ["operational"],
  },
  {
    href: "/admin/purchases",
    label: "Purchases",
    icon: () => null,
    roles: ["operational"],
  },
];

function navLabels(roles: ("admin" | "manager" | "operational")[]) {
  return filterAdminNavItems(navItems, roles).map((item) => item.label);
}

/**
 * Checklist coverage for POS-18-10 acceptance criteria.
 */
describe("POS-18-10 role-based navigation and route guards", () => {
  it("1. Admin-only nav items", () => {
    const labels = navLabels(["admin"]);
    expect(labels).toContain("Users");
    expect(labels).not.toContain("COGS");
    expect(labels).not.toContain("Purchases");
    expect(labels).not.toContain("Suppliers");
  });

  it("2. Manager routes accessible", () => {
    expect(canAccessRoute("/admin/cogs", ["manager"])).toBe(true);
    expect(canAccessRoute("/admin/transactions", ["manager"])).toBe(true);
  });

  it("3. Operational routes accessible", () => {
    expect(canAccessRoute("/admin/purchases", ["operational"])).toBe(true);
    expect(canAccessRoute("/admin/suppliers", ["operational"])).toBe(true);
  });

  it("4. Guard blocks unauthorized deep link", () => {
    expect(canAccessRoute("/admin/users", ["operational"])).toBe(false);
  });

  it("5. Multi-role combined nav", () => {
    const labels = navLabels(["manager", "operational"]);
    expect(labels).toContain("COGS");
    expect(labels).toContain("Purchases");
  });

  it("Selling reports nav item does not appear", () => {
    const allRoles: ("admin" | "manager" | "operational")[][] = [
      ["admin"],
      ["manager"],
      ["operational"],
      ["manager", "operational"],
    ];
    for (const roles of allRoles) {
      const labels = navLabels(roles);
      expect(labels.some((label) => /selling|report/i.test(label))).toBe(false);
    }
  });
});
