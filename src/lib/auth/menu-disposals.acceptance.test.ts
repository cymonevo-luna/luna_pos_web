import { describe, it, expect } from "vitest";
import { canAccessRoute } from "@/lib/auth/roles";
import { sourceWithFeatures } from "@/lib/auth/feature-fixtures";
import { filterAdminNavItems, allNavItems } from "@/app/admin/(protected)/layout";

describe("menu disposals route guards", () => {
  it("allows manager with menu_disposals.view", () => {
    const manager = sourceWithFeatures(["manager"]);
    expect(canAccessRoute("/admin/menu-disposals", manager)).toBe(true);
  });

  it("blocks cashier without menu_disposals.view", () => {
    const cashier = sourceWithFeatures(["cashier"]);
    expect(canAccessRoute("/admin/menu-disposals", cashier)).toBe(false);
  });

  it("shows Menu Disposals nav item for manager", () => {
    const items = filterAdminNavItems(allNavItems, sourceWithFeatures(["manager"]));
    const foodGroup = items.find(
      (entry) => "children" in entry && entry.label === "Food",
    );
    expect(foodGroup && "children" in foodGroup).toBe(true);
    if (!foodGroup || !("children" in foodGroup)) return;
    expect(
      foodGroup.children.some((child) => child.label === "Menu Disposals"),
    ).toBe(true);
  });
});
