import { describe, it, expect } from "vitest";
import { allNavItems, filterAdminNavItems, flattenAdminNavLabels } from "@/app/admin/(protected)/layout";
import { canAccessRoute, getUnauthorizedFallbackPath } from "@/lib/auth/roles";
import { featuresForRoles, sourceWithFeatures } from "@/lib/auth/feature-fixtures";

/**
 * Checklist coverage for POS-89-6 feature-driven navigation.
 */
describe("POS-89-6 feature-driven admin navigation", () => {
  it("manager sees default admin nav areas", () => {
    const manager = sourceWithFeatures(["manager"]);
    const labels = flattenAdminNavLabels(filterAdminNavItems(allNavItems, manager));

    expect(labels).toContain("Menu");
    expect(labels).toContain("Menu Breakdown");
    expect(labels).toContain("User Transactions");
    expect(labels).not.toContain("Users");
    expect(labels).not.toContain("Staff");
    expect(labels).not.toContain("List");
  });

  it("updated mapping hides COGS nav after cogs.view is removed", () => {
    const managerWithoutCogs = sourceWithFeatures(
      ["manager"],
      featuresForRoles(["manager"]).filter((feature) => feature !== "cogs.view"),
    );
    const labels = flattenAdminNavLabels(
      filterAdminNavItems(allNavItems, managerWithoutCogs),
    );

    expect(labels).not.toContain("COGS");
    expect(labels).not.toContain("Menu Breakdown");
    expect(canAccessRoute("/admin/cogs", managerWithoutCogs)).toBe(false);
    expect(getUnauthorizedFallbackPath(managerWithoutCogs)).toBe(
      "/admin/unauthorized",
    );
  });

  it("multi-feature users see union of nav items", () => {
    const combined = sourceWithFeatures(["manager", "operational"]);
    const labels = flattenAdminNavLabels(
      filterAdminNavItems(allNavItems, combined),
    );

    expect(labels).toContain("Menu Breakdown");
    expect(labels).toContain("List");
  });

  it("cashier cannot access admin area", () => {
    const cashier = sourceWithFeatures(["cashier"]);
    expect(canAccessRoute("/admin", cashier)).toBe(false);
    expect(canAccessRoute("/admin/menus", cashier)).toBe(false);
    const labels = flattenAdminNavLabels(filterAdminNavItems(allNavItems, cashier));
    expect(labels).not.toContain("Menu");
    expect(labels).not.toContain("Users");
    expect(labels).not.toContain("COGS");
  });
});
