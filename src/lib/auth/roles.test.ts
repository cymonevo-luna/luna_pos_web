import { describe, it, expect } from "vitest";
import type { MerchantRole } from "@/lib/api/types";
import { sourceWithFeatures } from "@/lib/auth/feature-fixtures";
import {
  canAccessNavFeature,
  canAccessRoute,
  countAdmins,
  formatUserRoles,
  getAuthenticatedLandingPath,
  getUnauthorizedFallbackPath,
  hasAnyRole,
  hasRole,
  isAdminOnlyUser,
  isCashierOnlyUser,
  resolveUserRoles,
  wouldRemoveLastAdmin,
} from "./roles";

describe("resolveUserRoles", () => {
  it("returns explicit roles when present", () => {
    expect(resolveUserRoles({ roles: ["admin"] })).toEqual(["admin"]);
  });

  it("returns an empty array when roles are missing", () => {
    expect(resolveUserRoles({ roles: [] })).toEqual([]);
  });
});

describe("hasRole", () => {
  it("checks membership in roles array", () => {
    expect(hasRole({ roles: ["manager"] }, "manager")).toBe(true);
    expect(hasRole({ roles: ["manager"] }, "admin")).toBe(false);
  });
});

describe("hasAnyRole", () => {
  it("returns true when any required role matches", () => {
    expect(hasAnyRole({ roles: ["manager", "operational"] }, ["admin"])).toBe(
      false,
    );
    expect(
      hasAnyRole({ roles: ["manager", "operational"] }, ["operational"]),
    ).toBe(true);
  });
});

describe("canAccessRoute", () => {
  it("allows admin users on user management routes", () => {
    const admin = sourceWithFeatures(["admin"]);
    expect(canAccessRoute("/admin/users", admin)).toBe(true);
    expect(canAccessRoute("/admin/users/abc", admin)).toBe(true);
  });

  it("blocks admin-only users from manager routes", () => {
    const admin = sourceWithFeatures(["admin"]);
    expect(canAccessRoute("/admin/cogs", admin)).toBe(false);
    expect(canAccessRoute("/admin/cogs/menu-breakdown", admin)).toBe(false);
    expect(canAccessRoute("/admin/transactions", admin)).toBe(false);
    expect(canAccessRoute("/admin/store-settings", admin)).toBe(false);
  });

  it("blocks admin-only users from operational routes", () => {
    const admin = sourceWithFeatures(["admin"]);
    expect(canAccessRoute("/admin/suppliers", admin)).toBe(false);
    expect(canAccessRoute("/admin/purchases", admin)).toBe(false);
  });

  it("allows admin-only users on production request list and detail routes", () => {
    const admin = sourceWithFeatures(["admin"]);
    expect(canAccessRoute("/admin/production-requests", admin)).toBe(true);
    expect(canAccessRoute("/admin/production-requests/prod-1", admin)).toBe(
      true,
    );
    expect(canAccessRoute("/admin/production-requests/new", admin)).toBe(false);
  });

  it("allows operational users on food-supplies routes", () => {
    const operational = sourceWithFeatures(["operational"]);
    expect(canAccessRoute("/admin/food-supplies", operational)).toBe(true);
  });

  it("blocks operational users from manager-only routes", () => {
    const operational = sourceWithFeatures(["operational"]);
    expect(canAccessRoute("/admin/cogs", operational)).toBe(false);
    expect(canAccessRoute("/admin/cogs/menu-breakdown", operational)).toBe(
      false,
    );
    expect(canAccessRoute("/admin/menus", operational)).toBe(false);
    expect(canAccessRoute("/admin/cash-flow", operational)).toBe(false);
    expect(canAccessRoute("/admin/cash-flow/bep", operational)).toBe(false);
    expect(canAccessRoute("/admin/order-options", operational)).toBe(false);
  });

  it("allows manager users on manager routes", () => {
    const manager = sourceWithFeatures(["manager"]);
    expect(canAccessRoute("/admin/cogs", manager)).toBe(true);
    expect(canAccessRoute("/admin/cogs/menu-breakdown", manager)).toBe(true);
    expect(canAccessRoute("/admin/cogs/summary", manager)).toBe(true);
    expect(canAccessRoute("/admin/cash-flow", manager)).toBe(true);
    expect(canAccessRoute("/admin/cash-flow/bep", manager)).toBe(true);
    expect(canAccessRoute("/admin/order-options", manager)).toBe(true);
    expect(canAccessRoute("/admin/menus/menu-1/ingredients", manager)).toBe(
      true,
    );
  });

  it("blocks manager users from operational routes", () => {
    const manager = sourceWithFeatures(["manager"]);
    expect(canAccessRoute("/admin/suppliers", manager)).toBe(false);
    expect(canAccessRoute("/admin/purchases", manager)).toBe(false);
  });

  it("allows manager users on production request list, detail, and create routes", () => {
    const manager = sourceWithFeatures(["manager"]);
    expect(canAccessRoute("/admin/production-requests", manager)).toBe(true);
    expect(canAccessRoute("/admin/production-requests/prod-1", manager)).toBe(
      true,
    );
    expect(canAccessRoute("/admin/production-requests/new", manager)).toBe(true);
  });

  it("blocks operational and cashier users from production request create route", () => {
    expect(
      canAccessRoute(
        "/admin/production-requests/new",
        sourceWithFeatures(["operational"]),
      ),
    ).toBe(false);
    expect(
      canAccessRoute(
        "/admin/production-requests/new",
        sourceWithFeatures(["cashier"]),
      ),
    ).toBe(false);
  });

  it("allows operational users on operational routes", () => {
    const operational = sourceWithFeatures(["operational"]);
    expect(canAccessRoute("/admin/purchases", operational)).toBe(true);
    expect(canAccessRoute("/admin/suppliers/new", operational)).toBe(true);
    expect(canAccessRoute("/admin/production-requests", operational)).toBe(
      true,
    );
    expect(
      canAccessRoute("/admin/production-requests/prod-1", operational),
    ).toBe(true);
  });

  it("blocks operational users from admin routes", () => {
    const operational = sourceWithFeatures(["operational"]);
    expect(canAccessRoute("/admin/users", operational)).toBe(false);
    expect(canAccessRoute("/admin/role-features", operational)).toBe(false);
  });

  it("allows admin users on privilege mapping routes", () => {
    expect(
      canAccessRoute("/admin/role-features", sourceWithFeatures(["admin"])),
    ).toBe(true);
  });

  it("blocks manager users from privilege mapping routes", () => {
    expect(
      canAccessRoute("/admin/role-features", sourceWithFeatures(["manager"])),
    ).toBe(false);
  });

  it("blocks cashier users from privilege mapping routes", () => {
    expect(
      canAccessRoute(
        "/admin/role-features",
        sourceWithFeatures(["cashier"]),
      ),
    ).toBe(false);
  });

  it("allows multi-feature users on union of routes", () => {
    const combined = sourceWithFeatures(["manager", "operational"]);
    expect(canAccessRoute("/admin/cogs", combined)).toBe(true);
    expect(canAccessRoute("/admin/cogs/menu-breakdown", combined)).toBe(true);
    expect(canAccessRoute("/admin/purchases", combined)).toBe(true);
    expect(canAccessRoute("/admin/production-requests", combined)).toBe(true);
    expect(canAccessRoute("/admin/production-requests/new", combined)).toBe(
      true,
    );
  });

  it("allows merchant-area users on the admin overview", () => {
    expect(canAccessRoute("/admin", sourceWithFeatures(["operational"]))).toBe(
      true,
    );
    expect(canAccessRoute("/admin", sourceWithFeatures(["admin"]))).toBe(true);
  });

  it("allows manager and operational users on recurring expenses routes", () => {
    expect(
      canAccessRoute("/admin/recurring-expenses", sourceWithFeatures(["manager"])),
    ).toBe(true);
    expect(
      canAccessRoute(
        "/admin/recurring-expenses",
        sourceWithFeatures(["operational"]),
      ),
    ).toBe(true);
  });

  it("allows manager and operational users on expenses routes", () => {
    const manager = sourceWithFeatures(["manager"]);
    const operational = sourceWithFeatures(["operational"]);
    expect(canAccessRoute("/admin/expenses", manager)).toBe(true);
    expect(canAccessRoute("/admin/expenses", operational)).toBe(true);
    expect(canAccessRoute("/admin/expenses/new", manager)).toBe(true);
    expect(canAccessRoute("/admin/expenses/exp-1/edit", operational)).toBe(
      true,
    );
  });

  it("blocks cashier and admin-only users from expenses routes", () => {
    expect(
      canAccessRoute("/admin/expenses", sourceWithFeatures(["cashier"])),
    ).toBe(false);
    expect(canAccessRoute("/admin/expenses", sourceWithFeatures(["admin"]))).toBe(
      false,
    );
  });

  it("blocks cashier and admin-only users from recurring expenses routes", () => {
    expect(
      canAccessRoute(
        "/admin/recurring-expenses",
        sourceWithFeatures(["cashier"]),
      ),
    ).toBe(false);
    expect(
      canAccessRoute(
        "/admin/recurring-expenses",
        sourceWithFeatures(["admin"]),
      ),
    ).toBe(false);
  });

  it("falls back to legacy role grants when features are missing", () => {
    expect(canAccessRoute("/admin/cogs", { roles: ["manager"] })).toBe(true);
    expect(canAccessRoute("/admin/users", { roles: ["operational"] })).toBe(
      false,
    );
  });
});

describe("getAuthenticatedLandingPath", () => {
  it("sends admin-only users to user management", () => {
    expect(getAuthenticatedLandingPath(sourceWithFeatures(["admin"]))).toBe(
      "/admin/users",
    );
  });

  it("sends manager users to the first accessible route", () => {
    expect(getAuthenticatedLandingPath(sourceWithFeatures(["manager"]))).toBe(
      "/admin/food-supplies",
    );
    expect(
      getAuthenticatedLandingPath(sourceWithFeatures(["admin", "manager"])),
    ).toBe("/admin/users");
  });

  it("sends operational-only users to food supplies", () => {
    expect(
      getAuthenticatedLandingPath(sourceWithFeatures(["operational"])),
    ).toBe("/admin/food-supplies");
  });

  it("sends cashier-only users to the dashboard", () => {
    expect(getAuthenticatedLandingPath(sourceWithFeatures(["cashier"]))).toBe(
      "/dashboard",
    );
    expect(getAuthenticatedLandingPath({ roles: [] })).toBe("/dashboard");
  });
});

describe("getUnauthorizedFallbackPath", () => {
  it("redirects merchant-area users to unauthorized", () => {
    expect(getUnauthorizedFallbackPath(sourceWithFeatures(["operational"]))).toBe(
      "/admin/unauthorized",
    );
  });

  it("redirects cashier users to dashboard", () => {
    expect(getUnauthorizedFallbackPath(sourceWithFeatures(["cashier"]))).toBe(
      "/dashboard",
    );
  });
});

describe("isAdminOnlyUser", () => {
  it("detects founding admin accounts", () => {
    expect(isAdminOnlyUser({ roles: ["admin"] })).toBe(true);
    expect(isAdminOnlyUser({ roles: ["admin", "manager"] })).toBe(false);
  });
});

describe("isCashierOnlyUser", () => {
  it("detects cashier-only accounts", () => {
    expect(isCashierOnlyUser(sourceWithFeatures(["cashier"]))).toBe(true);
    expect(isCashierOnlyUser(sourceWithFeatures(["manager"]))).toBe(false);
  });
});

describe("formatUserRoles", () => {
  it("joins role labels for display", () => {
    expect(formatUserRoles(["manager", "operational"])).toBe(
      "Manager, Operational",
    );
  });
});

describe("countAdmins and wouldRemoveLastAdmin", () => {
  const users = [
    { id: "admin-1", roles: ["admin"] as MerchantRole[] },
    { id: "cashier-1", roles: ["cashier"] as MerchantRole[] },
  ];

  it("counts admin users", () => {
    expect(countAdmins(users)).toBe(1);
  });

  it("detects removing the last admin", () => {
    expect(
      wouldRemoveLastAdmin(
        { id: "admin-1", roles: ["admin"] },
        ["manager"],
        [{ id: "admin-1", roles: ["admin"] }],
      ),
    ).toBe(true);
  });
});

describe("canAccessNavFeature", () => {
  it("allows unrestricted nav items", () => {
    expect(canAccessNavFeature(sourceWithFeatures(["admin"]), undefined)).toBe(
      true,
    );
  });

  it("requires the matching feature", () => {
    expect(
      canAccessNavFeature(sourceWithFeatures(["admin"]), "users.manage"),
    ).toBe(true);
    expect(
      canAccessNavFeature(sourceWithFeatures(["admin"]), "cogs.view"),
    ).toBe(false);
  });
});
