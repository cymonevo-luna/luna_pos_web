import { describe, it, expect } from "vitest";
import { filterAdminNavItems } from "@/app/admin/(protected)/layout";
import { canAccessRoute, getUnauthorizedFallbackPath } from "@/lib/auth/roles";
import { sourceWithFeatures } from "@/lib/auth/feature-fixtures";

const managerNavLabels = filterAdminNavItems(
  [
    {
      href: "/admin/branch-assets",
      label: "Branch Assets",
      icon: () => null,
      feature: "branch_assets.manage",
    },
  ],
  sourceWithFeatures(["manager"]),
).map((item) => item.label);

/**
 * Checklist coverage for POS-52-5 branch assets summary acceptance criteria.
 */
describe("POS-52-5 branch assets summary guards", () => {
  it("1. Manager can access branch assets summary", () => {
    const manager = sourceWithFeatures(["manager"]);
    expect(canAccessRoute("/admin/branch-assets/summary", manager)).toBe(true);
    expect(canAccessRoute("/admin/branch-assets", manager)).toBe(true);
    expect(managerNavLabels).toContain("Branch Assets");
  });

  it("6. Cashier cannot access branch assets summary", () => {
    const cashier = sourceWithFeatures(["cashier"]);
    expect(canAccessRoute("/admin/branch-assets/summary", cashier)).toBe(false);
    expect(getUnauthorizedFallbackPath(cashier)).toBe("/dashboard");
  });

  it("admin and operational users are blocked from branch assets", () => {
    const admin = sourceWithFeatures(["admin"]);
    const operational = sourceWithFeatures(["operational"]);
    expect(canAccessRoute("/admin/branch-assets/summary", admin)).toBe(false);
    expect(canAccessRoute("/admin/branch-assets/summary", operational)).toBe(
      false,
    );
  });
});
