import { describe, it, expect } from "vitest";
import { canAccessRoute } from "@/lib/auth/roles";
import { sourceWithFeatures } from "@/lib/auth/feature-fixtures";
import {
  adminUserCreateSchema,
  adminUserRolesSchema,
} from "@/lib/validations";
import { wouldRemoveLastAdmin } from "@/lib/auth/roles";
import type { MerchantRole } from "@/lib/api/types";

/**
 * Checklist coverage for POS-18-11 acceptance criteria.
 */
describe("POS-18-11 admin user management", () => {
  it("1. User list loads for admin — route is admin-only", () => {
    expect(canAccessRoute("/admin/users", sourceWithFeatures(["admin"]))).toBe(true);
  });

  it("2. Create user with multiple roles — schema accepts cashier + operational", () => {
    const result = adminUserCreateSchema.safeParse({
      email: "ops@example.com",
      name: "Ops User",
      password: "password123",
      roles: ["cashier", "operational"],
    });
    expect(result.success).toBe(true);
  });

  describe("Cook", () => {
    it("2b. Create user with cook role — schema accepts cook assignment", () => {
      const result = adminUserCreateSchema.safeParse({
        email: "cook@example.com",
        name: "Cook User",
        password: "password123",
        roles: ["cook"],
      });
      expect(result.success).toBe(true);

      const rolesResult = adminUserRolesSchema.safeParse({ roles: ["cook"] });
      expect(rolesResult.success).toBe(true);
    });
  });

  it("3. Edit roles updates display — schema accepts role changes", () => {
    const result = adminUserRolesSchema.safeParse({ roles: ["manager"] });
    expect(result.success).toBe(true);
  });

  it("4. Non-admin blocked from user management", () => {
    expect(canAccessRoute("/admin/users", sourceWithFeatures(["manager"]))).toBe(false);
    expect(canAccessRoute("/admin/users", sourceWithFeatures(["operational"]))).toBe(false);
  });

  it("5. Last admin removal shows error — detects last-admin scenario", () => {
    const users = [{ id: "admin-1", roles: ["admin"] as MerchantRole[] }];
    expect(
      wouldRemoveLastAdmin(
        { id: "admin-1", roles: ["admin"] },
        ["manager"],
        users,
      ),
    ).toBe(true);
  });
});
