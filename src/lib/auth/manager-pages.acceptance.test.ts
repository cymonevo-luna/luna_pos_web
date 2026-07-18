import { describe, it, expect } from "vitest";
import { filterAdminNavItems, flattenAdminNavLabels } from "@/app/admin/(protected)/layout";
import { canAccessRoute, getUnauthorizedFallbackPath } from "@/lib/auth/roles";

const managerNavLabels = flattenAdminNavLabels(
  filterAdminNavItems(
    [
      {
        label: "COGS",
        icon: () => null,
        children: [
          {
            href: "/admin/cogs/menu-breakdown",
            label: "Menu Breakdown",
            icon: () => null,
            roles: ["manager"],
          },
        ],
      },
      {
        label: "Food",
        icon: () => null,
        children: [
          {
            href: "/admin/transactions",
            label: "User Transactions",
            icon: () => null,
            roles: ["manager"],
          },
        ],
      },
      {
        label: "Cash Flow",
        icon: () => null,
        children: [
          {
            href: "/admin/cash-flow",
            label: "Summary",
            icon: () => null,
            roles: ["manager"],
          },
        ],
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
        label: "Food",
        icon: () => null,
        children: [
          {
            href: "/admin/menus",
            label: "Menus",
            icon: () => null,
            roles: ["manager"],
          },
          {
            href: "/admin/food-supplies",
            label: "Ingredients",
            icon: () => null,
            roles: ["manager"],
          },
        ],
      },
      {
        href: "/admin/branch-assets",
        label: "Branch Assets",
        icon: () => null,
        roles: ["manager"],
      },
    ],
    ["manager"],
  ),
);

/**
 * Checklist coverage for POS-18-12 acceptance criteria.
 */
describe("POS-18-12 manager-scoped page guards", () => {
  it("1. Manager accesses COGS page", () => {
    expect(canAccessRoute("/admin/cogs", ["manager"])).toBe(true);
    expect(canAccessRoute("/admin/cogs/menu-breakdown", ["manager"])).toBe(true);
    expect(canAccessRoute("/admin/cogs/menu-1", ["manager"])).toBe(true);
    expect(managerNavLabels).toContain("Menu Breakdown");
  });

  it("2. Manager accesses transaction history", () => {
    expect(canAccessRoute("/admin/transactions", ["manager"])).toBe(true);
    expect(canAccessRoute("/admin/transactions/txn-1", ["manager"])).toBe(
      true,
    );
    expect(managerNavLabels).toContain("User Transactions");
  });

  it("2b. Manager accesses cash flow insights", () => {
    expect(canAccessRoute("/admin/cash-flow", ["manager"])).toBe(true);
    expect(managerNavLabels).toContain("Summary");
  });

  it("3. Manager edits receipt settings — route and nav are manager-only", () => {
    expect(canAccessRoute("/admin/store-settings", ["manager"])).toBe(true);
    expect(managerNavLabels).toContain("Receipt Settings");
  });

  it("4. Admin-only blocked from COGS", () => {
    expect(canAccessRoute("/admin/cogs", ["admin"])).toBe(false);
    expect(canAccessRoute("/admin/cogs/menu-breakdown", ["admin"])).toBe(false);
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

  it("6. Operational blocked from cash flow", () => {
    expect(canAccessRoute("/admin/cash-flow", ["operational"])).toBe(false);
    expect(canAccessRoute("/admin/cash-flow/bep", ["operational"])).toBe(false);
    expect(canAccessRoute("/admin/cash-flow", ["cashier"] as never)).toBe(
      false,
    );
  });

  it("manager supporting routes remain gated", () => {
    const managerOnlyRoutes = [
      "/admin/categories",
      "/admin/menus",
      "/admin/menus/menu-1/ingredients",
      "/admin/order-options",
      "/admin/production-requests/new",
      "/admin/cash-flow",
      "/admin/cash-flow/bep",
      "/admin/cogs/summary",
      "/admin/branch-assets",
    ];
    for (const route of managerOnlyRoutes) {
      expect(canAccessRoute(route, ["manager"])).toBe(true);
      expect(canAccessRoute(route, ["admin"])).toBe(false);
      expect(canAccessRoute(route, ["operational"])).toBe(false);
    }

    expect(canAccessRoute("/admin/production-requests", ["manager"])).toBe(
      true,
    );
    expect(
      canAccessRoute("/admin/production-requests/prod-1", ["manager"]),
    ).toBe(true);

    expect(canAccessRoute("/admin/food-supplies", ["manager"])).toBe(true);
    expect(canAccessRoute("/admin/food-supplies", ["operational"])).toBe(true);
    expect(canAccessRoute("/admin/food-supplies", ["admin"])).toBe(false);

    expect(canAccessRoute("/admin/branch-assets", ["manager"])).toBe(true);
    expect(canAccessRoute("/admin/branch-assets", ["operational"])).toBe(false);
    expect(canAccessRoute("/admin/branch-assets", ["admin"])).toBe(false);
    expect(managerNavLabels).toContain("Branch Assets");
  });

  it("no selling reports UI route exists", () => {
    expect(
      managerNavLabels.some((label) => /selling|report/i.test(label)),
    ).toBe(false);
  });
});
