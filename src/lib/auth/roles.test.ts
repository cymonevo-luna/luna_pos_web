import { describe, it, expect } from "vitest";
import {
  canAccessNavRoles,
  canAccessRoute,
  formatUserRoles,
  getAuthenticatedLandingPath,
  getUnauthorizedFallbackPath,
  hasAnyRole,
  hasRole,
  isAdminOnlyUser,
  isCashierOnlyUser,
  resolveUserRoles,
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
    expect(canAccessRoute("/admin/users", ["admin"])).toBe(true);
    expect(canAccessRoute("/admin/users/abc", ["admin"])).toBe(true);
  });

  it("blocks admin-only users from manager routes", () => {
    expect(canAccessRoute("/admin/cogs", ["admin"])).toBe(false);
    expect(canAccessRoute("/admin/transactions", ["admin"])).toBe(false);
  });

  it("allows manager users on manager routes", () => {
    expect(canAccessRoute("/admin/cogs", ["manager"])).toBe(true);
    expect(canAccessRoute("/admin/menus/menu-1/ingredients", ["manager"])).toBe(
      true,
    );
  });

  it("blocks manager users from operational routes", () => {
    expect(canAccessRoute("/admin/suppliers", ["manager"])).toBe(false);
    expect(canAccessRoute("/admin/purchases", ["manager"])).toBe(false);
  });

  it("allows operational users on operational routes", () => {
    expect(canAccessRoute("/admin/purchases", ["operational"])).toBe(true);
    expect(canAccessRoute("/admin/suppliers/new", ["operational"])).toBe(true);
  });

  it("blocks operational users from admin routes", () => {
    expect(canAccessRoute("/admin/users", ["operational"])).toBe(false);
  });

  it("allows multi-role users on union of routes", () => {
    expect(canAccessRoute("/admin/cogs", ["manager", "operational"])).toBe(
      true,
    );
    expect(
      canAccessRoute("/admin/purchases", ["manager", "operational"]),
    ).toBe(true);
  });

  it("allows merchant-area users on the admin overview", () => {
    expect(canAccessRoute("/admin", ["operational"])).toBe(true);
    expect(canAccessRoute("/admin", ["admin"])).toBe(true);
  });
});

describe("getAuthenticatedLandingPath", () => {
  it("sends admin-only users to user management", () => {
    expect(getAuthenticatedLandingPath({ roles: ["admin"] })).toBe(
      "/admin/users",
    );
  });

  it("sends manager users to the admin overview", () => {
    expect(getAuthenticatedLandingPath({ roles: ["manager"] })).toBe("/admin");
    expect(getAuthenticatedLandingPath({ roles: ["admin", "manager"] })).toBe(
      "/admin",
    );
  });

  it("sends operational-only users to suppliers", () => {
    expect(getAuthenticatedLandingPath({ roles: ["operational"] })).toBe(
      "/admin/suppliers",
    );
  });

  it("sends cashier-only users to the dashboard", () => {
    expect(getAuthenticatedLandingPath({ roles: ["cashier"] as never })).toBe(
      "/dashboard",
    );
    expect(getAuthenticatedLandingPath({ roles: [] })).toBe("/dashboard");
  });
});

describe("getUnauthorizedFallbackPath", () => {
  it("matches the authenticated landing path", () => {
    expect(getUnauthorizedFallbackPath({ roles: ["operational"] })).toBe(
      "/admin/suppliers",
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
    expect(isCashierOnlyUser({ roles: ["cashier"] as never })).toBe(true);
    expect(isCashierOnlyUser({ roles: ["manager"] })).toBe(false);
  });
});

describe("formatUserRoles", () => {
  it("joins roles for display", () => {
    expect(formatUserRoles(["manager", "operational"])).toBe(
      "manager, operational",
    );
  });
});

describe("canAccessNavRoles", () => {
  it("allows unrestricted nav items", () => {
    expect(canAccessNavRoles(["admin"], undefined)).toBe(true);
  });

  it("requires at least one matching role", () => {
    expect(canAccessNavRoles(["admin"], ["admin"])).toBe(true);
    expect(canAccessNavRoles(["admin"], ["manager"])).toBe(false);
  });
});
