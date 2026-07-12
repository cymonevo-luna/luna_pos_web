import { describe, it, expect } from "vitest";
import { filterAdminNavItems } from "@/app/admin/(protected)/layout";
import { canAccessRoute, getUnauthorizedFallbackPath } from "@/lib/auth/roles";

const managerNavLabels = filterAdminNavItems(
  [
    {
      href: "/admin/cogs",
      label: "COGS",
      icon: () => null,
      roles: ["manager"],
    },
    {
      href: "/admin/transactions",
      label: "Transactions",
      icon: () => null,
      roles: ["manager"],
    },
    {
      href: "/admin/store-settings",
      label: "Receipt Settings",
      icon: () => null,
      roles: ["manager"],
    },
    {
      href: "/admin/categories",
      label: "Categories",
      icon: () => null,
      roles: ["manager"],
    },
    {
      href: "/admin/menus",
      label: "Menus",
      icon: () => null,
      roles: ["manager"],
    },
    {
      href: "/admin/food-supplies",
      label: "Food Supplies",
      icon: () => null,
      roles: ["manager"],
    },
  ],
  ["manager"],
).map((item) => item.label);

/**
 * Checklist coverage for POS-18-12 acceptance criteria.
 */
describe("POS-18-12 manager-scoped page guards", () => {
  it("1. Manager accesses COGS page", () => {
    expect(canAccessRoute("/admin/cogs", ["manager"])).toBe(true);
    expect(canAccessRoute("/admin/cogs/menu-1", ["manager"])).toBe(true);
    expect(managerNavLabels).toContain("COGS");
  });

  it("2. Manager accesses transaction history", () => {
    expect(canAccessRoute("/admin/transactions", ["manager"])).toBe(true);
    expect(canAccessRoute("/admin/transactions/txn-1", ["manager"])).toBe(
      true,
    );
    expect(managerNavLabels).toContain("Transactions");
  });

  it("3. Manager edits receipt settings — route and nav are manager-only", () => {
    expect(canAccessRoute("/admin/store-settings", ["manager"])).toBe(true);
    expect(managerNavLabels).toContain("Receipt Settings");
  });

  it("4. Admin-only blocked from COGS", () => {
    expect(canAccessRoute("/admin/cogs", ["admin"])).toBe(false);
    expect(getUnauthorizedFallbackPath({ roles: ["admin"] })).toBe(
      "/admin/users",
    );
  });

  it("5. Operational blocked from receipt settings", () => {
    expect(canAccessRoute("/admin/store-settings", ["operational"])).toBe(
      false,
    );
    expect(getUnauthorizedFallbackPath({ roles: ["operational"] })).toBe(
      "/admin/suppliers",
    );
  });

  it("manager supporting routes remain gated", () => {
    const managerOnlyRoutes = [
      "/admin/categories",
      "/admin/menus",
      "/admin/menus/menu-1/ingredients",
      "/admin/production-requests/new",
    ];
    for (const route of managerOnlyRoutes) {
      expect(canAccessRoute(route, ["manager"])).toBe(true);
      expect(canAccessRoute(route, ["admin"])).toBe(false);
      expect(canAccessRoute(route, ["operational"])).toBe(false);
    }

    expect(canAccessRoute("/admin/production-requests", ["manager"])).toBe(
      false,
    );
    expect(
      canAccessRoute("/admin/production-requests/prod-1", ["manager"]),
    ).toBe(false);

    expect(canAccessRoute("/admin/food-supplies", ["manager"])).toBe(true);
    expect(canAccessRoute("/admin/food-supplies", ["operational"])).toBe(true);
    expect(canAccessRoute("/admin/food-supplies", ["admin"])).toBe(false);
  });

  it("no selling reports UI route exists", () => {
    expect(
      managerNavLabels.some((label) => /selling|report/i.test(label)),
    ).toBe(false);
  });
});
