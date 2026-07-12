import { describe, it, expect } from "vitest";
import {
  canAccessNavRoles,
  formatUserRoles,
  getAuthenticatedLandingPath,
  isAdminOnlyUser,
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

describe("getAuthenticatedLandingPath", () => {
  it("sends admin-only users to user management", () => {
    expect(getAuthenticatedLandingPath({ roles: ["admin"] })).toBe("/admin/users");
  });

  it("sends manager users to the admin overview", () => {
    expect(getAuthenticatedLandingPath({ roles: ["admin", "manager"] })).toBe(
      "/admin",
    );
  });

  it("sends non-admin users to the dashboard", () => {
    expect(getAuthenticatedLandingPath({ roles: [] })).toBe("/dashboard");
  });
});

describe("isAdminOnlyUser", () => {
  it("detects founding admin accounts", () => {
    expect(isAdminOnlyUser({ roles: ["admin"] })).toBe(true);
    expect(isAdminOnlyUser({ roles: ["admin", "manager"] })).toBe(false);
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
