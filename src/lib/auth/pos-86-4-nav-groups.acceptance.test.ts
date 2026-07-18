import { describe, it, expect } from "vitest";
import {
  allNavItems,
  filterAdminNavItems,
  flattenAdminNavLabels,
} from "@/app/admin/(protected)/layout";
import { isNavGroup } from "@/components/layout/dashboard-shell";
import { canAccessRoute } from "@/lib/auth/roles";
import { sourceWithFeatures } from "@/lib/auth/feature-fixtures";

function groupLabels(items: ReturnType<typeof filterAdminNavItems>): string[] {
  return items.filter(isNavGroup).map((entry) => entry.label);
}

function childLabels(
  items: ReturnType<typeof filterAdminNavItems>,
  groupLabel: string,
): string[] {
  const group = items.find(
    (entry) => isNavGroup(entry) && entry.label === groupLabel,
  );
  if (!group || !isNavGroup(group)) {
    return [];
  }
  return group.children.map((child) => child.label);
}

/**
 * Checklist coverage for POS-86-4 acceptance criteria.
 */
describe("POS-86-4 admin sidebar nav groups", () => {
  it("1. Manager sees three feature-filtered nav groups", () => {
    const filtered = filterAdminNavItems(allNavItems, sourceWithFeatures(["manager"]));
    const labels = flattenAdminNavLabels(filtered);

    expect(groupLabels(filtered)).toEqual([
      "Food",
      "COGS",
      "Cash Flow",
      "Branch",
    ]);
    expect(labels).not.toContain("Supplier");

    expect(childLabels(filtered, "Food")).toEqual([
      "Ingredients",
      "Categories",
      "Menu",
      "Cook Request",
      "User Transactions",
    ]);
    expect(childLabels(filtered, "COGS")).toEqual([
      "Menu Breakdown",
      "Summary",
    ]);
    expect(childLabels(filtered, "Cash Flow")).toEqual([
      "Expenses",
      "Recurring Expenses",
      "Cashier Balance",
      "BEP",
      "Summary",
    ]);
  });

  it("2. Manager-only user does not see Supplier group or children", () => {
    const manager = sourceWithFeatures(["manager"]);
    const labels = flattenAdminNavLabels(
      filterAdminNavItems(allNavItems, manager),
    );

    expect(labels).not.toContain("Supplier");
    expect(labels).not.toContain("List");
    expect(labels).not.toContain("Purchases");
    expect(canAccessRoute("/admin/suppliers", manager)).toBe(false);
    expect(canAccessRoute("/admin/purchases", manager)).toBe(false);
  });

  it("3. Operational role filtered nav", () => {
    const filtered = filterAdminNavItems(
      allNavItems,
      sourceWithFeatures(["operational"]),
    );
    const labels = flattenAdminNavLabels(filtered);

    expect(groupLabels(filtered)).toEqual(["Food", "Supplier", "Cash Flow"]);
    expect(labels).not.toContain("COGS");

    expect(childLabels(filtered, "Food")).toEqual([
      "Ingredients",
      "Cook Request",
    ]);
    expect(childLabels(filtered, "Supplier")).toEqual(["List", "Purchases"]);
    expect(childLabels(filtered, "Cash Flow")).toEqual([
      "Expenses",
      "Recurring Expenses",
      "Cashier Balance",
    ]);
  });

  it("4. Combined manager + operational nav", () => {
    const labels = flattenAdminNavLabels(
      filterAdminNavItems(allNavItems, sourceWithFeatures(["manager", "operational"])),
    );

    expect(labels).toContain("COGS");
    expect(labels).toContain("Purchases");
    expect(labels).toContain("Cook Request");
  });

  it("5. Empty group omission", () => {
    const filtered = filterAdminNavItems(
      allNavItems,
      sourceWithFeatures(["operational"]),
    );
    const cogsGroup = filtered.find(
      (entry) => isNavGroup(entry) && entry.label === "COGS",
    );

    expect(cogsGroup).toBeUndefined();
  });

  it("6. Admin sees privilege mapping nav item", () => {
    const labels = flattenAdminNavLabels(
      filterAdminNavItems(allNavItems, sourceWithFeatures(["admin"])),
    );

    expect(labels).toContain("Privilege Mapping");
    expect(canAccessRoute("/admin/role-features", sourceWithFeatures(["admin"]))).toBe(
      true,
    );
  });
});
