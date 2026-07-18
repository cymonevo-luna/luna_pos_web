import { describe, it, expect } from "vitest";
import { filterAdminNavItems, allNavItems } from "@/app/admin/(protected)/layout";
import { canAccessRoute } from "@/lib/auth/roles";
import { isNavGroup } from "@/components/layout/dashboard-shell";

/**
 * Checklist coverage for POS-89-5 acceptance criteria.
 */
describe("POS-89-5 privilege mapping acceptance", () => {
  it("1. Admin can open privilege mapping page", () => {
    expect(canAccessRoute("/admin/role-features", ["admin"])).toBe(true);

    const filtered = filterAdminNavItems(allNavItems, ["admin"]);
    const branchGroup = filtered.find(
      (entry) => isNavGroup(entry) && entry.label === "Branch",
    );
    expect(branchGroup && isNavGroup(branchGroup)).toBe(true);
    if (!branchGroup || !isNavGroup(branchGroup)) {
      return;
    }

    expect(branchGroup.children.some((child) => child.label === "Privilege Mapping")).toBe(
      true,
    );
  });

  it("3. Manager cannot access page", () => {
    expect(canAccessRoute("/admin/role-features", ["manager"])).toBe(false);

    const filtered = filterAdminNavItems(allNavItems, ["manager"]);
    const labels = filtered.flatMap((entry) =>
      isNavGroup(entry)
        ? entry.children.map((child) => child.label)
        : [entry.label],
    );
    expect(labels).not.toContain("Privilege Mapping");
  });
});
