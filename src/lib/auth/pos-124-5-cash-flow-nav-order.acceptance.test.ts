import { describe, it, expect } from "vitest";
import {
  allNavItems,
  filterAdminNavItems,
} from "@/app/admin/(protected)/layout";
import { isNavGroup } from "@/components/layout/dashboard-shell";
import { canAccessRoute } from "@/lib/auth/roles";
import { featuresForRoles, sourceWithFeatures } from "@/lib/auth/feature-fixtures";

function cashFlowChildLabels(
  items: ReturnType<typeof filterAdminNavItems>,
): string[] {
  const group = items.find(
    (entry) => isNavGroup(entry) && entry.label === "Cash Flow",
  );
  if (!group || !isNavGroup(group)) {
    return [];
  }
  return group.children.map((child) => child.label);
}

/**
 * Checklist coverage for POS-124-5 acceptance criteria.
 */
describe("POS-124-5 Cash Flow nav order", () => {
  it("1. Cashier Balance appears above Expenses in sidebar", () => {
    const filtered = filterAdminNavItems(
      allNavItems,
      sourceWithFeatures(["manager"]),
    );
    const labels = cashFlowChildLabels(filtered);

    expect(labels).toEqual([
      "Cashier Balance",
      "BEP",
      "Summary",
      "Expenses",
      "Recurring Expenses",
    ]);
    expect(labels.indexOf("Cashier Balance")).toBeLessThan(
      labels.indexOf("Expenses"),
    );
  });

  it("2. Cashier Balance link navigates correctly", () => {
    const manager = sourceWithFeatures(["manager"]);
    expect(canAccessRoute("/admin/cashier-balance", manager)).toBe(true);

    const filtered = filterAdminNavItems(allNavItems, manager);
    const group = filtered.find(
      (entry) => isNavGroup(entry) && entry.label === "Cash Flow",
    );
    expect(group && isNavGroup(group)).toBe(true);
    if (!group || !isNavGroup(group)) {
      return;
    }

    const cashierBalance = group.children.find(
      (child) => child.label === "Cashier Balance",
    );
    expect(cashierBalance?.href).toBe("/admin/cashier-balance");
  });

  it("3. User without cashier feature does not see link", () => {
    const expensesOnly = sourceWithFeatures(
      ["manager"],
      featuresForRoles(["manager"]).filter(
        (feature) => feature !== "cashier_balance.manage",
      ),
    );
    const labels = cashFlowChildLabels(
      filterAdminNavItems(allNavItems, expensesOnly),
    );

    expect(labels).not.toContain("Cashier Balance");
    expect(labels).toContain("Expenses");
    expect(canAccessRoute("/admin/cashier-balance", expensesOnly)).toBe(false);
  });

  it("4. Regression: Expenses page still accessible", () => {
    const manager = sourceWithFeatures(["manager"]);
    expect(canAccessRoute("/admin/expenses", manager)).toBe(true);

    const filtered = filterAdminNavItems(allNavItems, manager);
    const group = filtered.find(
      (entry) => isNavGroup(entry) && entry.label === "Cash Flow",
    );
    expect(group && isNavGroup(group)).toBe(true);
    if (!group || !isNavGroup(group)) {
      return;
    }

    const expenses = group.children.find((child) => child.label === "Expenses");
    expect(expenses?.href).toBe("/admin/expenses");
  });
});
