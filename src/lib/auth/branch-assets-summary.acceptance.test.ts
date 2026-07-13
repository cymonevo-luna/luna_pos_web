import { describe, it, expect } from "vitest";
import { filterAdminNavItems } from "@/app/admin/(protected)/layout";
import { canAccessRoute, getUnauthorizedFallbackPath } from "@/lib/auth/roles";

const managerNavLabels = filterAdminNavItems(
  [
    {
      href: "/admin/branch-assets",
      label: "Branch Assets",
      icon: () => null,
      roles: ["manager"],
    },
  ],
  ["manager"],
).map((item) => item.label);

/**
 * Checklist coverage for POS-52-5 branch assets summary acceptance criteria.
 */
describe("POS-52-5 branch assets summary guards", () => {
  it("1. Manager can access branch assets summary", () => {
    expect(canAccessRoute("/admin/branch-assets/summary", ["manager"])).toBe(
      true,
    );
    expect(canAccessRoute("/admin/branch-assets", ["manager"])).toBe(true);
    expect(managerNavLabels).toContain("Branch Assets");
  });

  it("6. Cashier cannot access branch assets summary", () => {
    expect(canAccessRoute("/admin/branch-assets/summary", ["cashier"])).toBe(
      false,
    );
    expect(getUnauthorizedFallbackPath({ roles: ["cashier"] })).toBe(
      "/dashboard",
    );
  });

  it("admin and operational users are blocked from branch assets", () => {
    expect(canAccessRoute("/admin/branch-assets/summary", ["admin"])).toBe(
      false,
    );
    expect(canAccessRoute("/admin/branch-assets/summary", ["operational"])).toBe(
      false,
    );
  });
});
