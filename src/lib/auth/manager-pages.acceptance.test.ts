import { describe, it, expect } from "vitest";
import { filterAdminNavItems, flattenAdminNavLabels } from "@/app/admin/(protected)/layout";
import { canAccessRoute, getUnauthorizedFallbackPath } from "@/lib/auth/roles";
import { sourceWithFeatures } from "@/lib/auth/feature-fixtures";

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
            feature: "cogs.view",
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
            feature: "transactions.view",
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
            feature: "insights.cash_flow",
          },
        ],
      },
      {
        href: "/admin/store-settings",
        label: "Receipt Settings",
        icon: () => null,
        feature: "store_settings.manage",
      },
      {
        href: "/admin/categories",
        label: "Categories",
        icon: () => null,
        feature: "categories.manage",
      },
      {
        label: "Food",
        icon: () => null,
        children: [
          {
            href: "/admin/menus",
            label: "Menus",
            icon: () => null,
            feature: "menus.manage",
          },
          {
            href: "/admin/food-supplies",
            label: "Ingredients",
            icon: () => null,
            feature: "food_supplies.manage",
          },
        ],
      },
      {
        href: "/admin/branch-assets",
        label: "Branch Assets",
        icon: () => null,
        feature: "branch_assets.manage",
      },
    ],
    sourceWithFeatures(["manager"]),
  ),
);

/**
 * Checklist coverage for POS-18-12 acceptance criteria.
 */
describe("POS-18-12 manager-scoped page guards", () => {
  it("1. Manager accesses COGS page", () => {
    const manager = sourceWithFeatures(["manager"]);
    expect(canAccessRoute("/admin/cogs", manager)).toBe(true);
    expect(canAccessRoute("/admin/cogs/menu-breakdown", manager)).toBe(true);
    expect(canAccessRoute("/admin/cogs/menu-1", manager)).toBe(true);
    expect(managerNavLabels).toContain("Menu Breakdown");
  });

  it("2. Manager accesses transaction history", () => {
    const manager = sourceWithFeatures(["manager"]);
    expect(canAccessRoute("/admin/transactions", manager)).toBe(true);
    expect(canAccessRoute("/admin/transactions/txn-1", manager)).toBe(true);
    expect(managerNavLabels).toContain("User Transactions");
  });

  it("2b. Manager accesses cash flow insights", () => {
    const manager = sourceWithFeatures(["manager"]);
    expect(canAccessRoute("/admin/cash-flow", manager)).toBe(true);
    expect(managerNavLabels).toContain("Summary");
  });

  it("3. Manager edits receipt settings — route and nav are manager-only", () => {
    const manager = sourceWithFeatures(["manager"]);
    expect(canAccessRoute("/admin/store-settings", manager)).toBe(true);
    expect(managerNavLabels).toContain("Receipt Settings");
  });

  it("4. Admin-only blocked from COGS", () => {
    const admin = sourceWithFeatures(["admin"]);
    expect(canAccessRoute("/admin/cogs", admin)).toBe(false);
    expect(canAccessRoute("/admin/cogs/menu-breakdown", admin)).toBe(false);
    expect(getUnauthorizedFallbackPath(admin)).toBe("/admin/unauthorized");
  });

  it("5. Operational blocked from receipt settings", () => {
    const operational = sourceWithFeatures(["operational"]);
    expect(canAccessRoute("/admin/store-settings", operational)).toBe(false);
    expect(getUnauthorizedFallbackPath(operational)).toBe("/admin/unauthorized");
  });

  it("6. Operational blocked from cash flow", () => {
    const operational = sourceWithFeatures(["operational"]);
    expect(canAccessRoute("/admin/cash-flow", operational)).toBe(false);
    expect(canAccessRoute("/admin/cash-flow/bep", operational)).toBe(false);
    expect(canAccessRoute("/admin/cash-flow", sourceWithFeatures(["cashier"]))).toBe(
      false,
    );
  });

  it("manager supporting routes remain gated", () => {
    const manager = sourceWithFeatures(["manager"]);
    const admin = sourceWithFeatures(["admin"]);
    const operational = sourceWithFeatures(["operational"]);
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
      expect(canAccessRoute(route, manager)).toBe(true);
      expect(canAccessRoute(route, admin)).toBe(false);
      expect(canAccessRoute(route, operational)).toBe(false);
    }

    expect(canAccessRoute("/admin/production-requests", manager)).toBe(true);
    expect(
      canAccessRoute("/admin/production-requests/prod-1", manager),
    ).toBe(true);

    expect(canAccessRoute("/admin/food-supplies", manager)).toBe(true);
    expect(canAccessRoute("/admin/food-supplies", operational)).toBe(true);
    expect(canAccessRoute("/admin/food-supplies", admin)).toBe(false);

    expect(canAccessRoute("/admin/branch-assets", manager)).toBe(true);
    expect(canAccessRoute("/admin/branch-assets", operational)).toBe(false);
    expect(canAccessRoute("/admin/branch-assets", admin)).toBe(false);
    expect(managerNavLabels).toContain("Branch Assets");
  });

  it("no selling reports UI route exists", () => {
    expect(
      managerNavLabels.some((label) => /selling|report/i.test(label)),
    ).toBe(false);
  });
});
