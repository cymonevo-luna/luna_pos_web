import { describe, it, expect } from "vitest";
import {
  canAccessNavRoles,
  getAuthenticatedLandingPath,
  isAdminOnlyUser,
  resolveUserRoles,
} from "./roles";

describe("resolveUserRoles", () => {
  it("returns explicit roles when present", () => {
    expect(resolveUserRoles({ role: "user", roles: ["admin"] })).toEqual([
      "admin",
    ]);
  });

  it("falls back to full merchant roles for legacy admin users", () => {
    expect(resolveUserRoles({ role: "admin" })).toEqual([
      "admin",
      "manager",
      "operational",
    ]);
  });
});

describe("getAuthenticatedLandingPath", () => {
  it("sends admin-only users to user management", () => {
    expect(
      getAuthenticatedLandingPath({ role: "admin", roles: ["admin"] }),
    ).toBe("/admin/users");
  });

  it("sends manager users to the admin overview", () => {
    expect(
      getAuthenticatedLandingPath({ role: "admin", roles: ["admin", "manager"] }),
    ).toBe("/admin");
  });

  it("sends non-admin users to the dashboard", () => {
    expect(getAuthenticatedLandingPath({ role: "user" })).toBe("/dashboard");
  });
});

describe("isAdminOnlyUser", () => {
  it("detects founding admin accounts", () => {
    expect(isAdminOnlyUser({ role: "admin", roles: ["admin"] })).toBe(true);
    expect(
      isAdminOnlyUser({ role: "admin", roles: ["admin", "manager"] }),
    ).toBe(false);
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
