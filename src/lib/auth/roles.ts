import type { JwtPayload } from "@/lib/auth/tokens";
import type { MerchantRole, User } from "@/lib/api/types";
import {
  hasAdminAreaFeatureAccess,
  hasAnyFeature,
  hasFeature,
  resolveUserFeatures,
  type FeatureSource,
} from "@/lib/auth/features";
import {
  LANDING_ROUTE_ORDER,
  resolveRouteFeature,
} from "@/lib/auth/feature-routes";

const MERCHANT_AREA_ROLES: MerchantRole[] = [
  "admin",
  "manager",
  "operational",
];

/** Roles an admin can assign when creating or editing users. */
export const ASSIGNABLE_ROLES: MerchantRole[] = [
  "admin",
  "manager",
  "cashier",
  "operational",
  "cook",
];

const ROLE_LABELS: Record<MerchantRole, string> = {
  admin: "Admin",
  manager: "Manager",
  cashier: "Cashier",
  operational: "Operational",
  cook: "Cook",
};

type RoleSource =
  | Pick<User, "roles">
  | JwtPayload
  | { roles?: MerchantRole[] }
  | null
  | undefined;

/** Resolve effective merchant roles from API user or JWT claims. */
export function resolveUserRoles(source: RoleSource): MerchantRole[] {
  if (!source) return [];
  return source.roles ?? [];
}

export function hasMerchantAreaAccess(source: FeatureSource): boolean {
  if (hasAdminAreaFeatureAccess(source)) {
    return true;
  }
  const roles = resolveUserRoles(source);
  return roles.some((role) => MERCHANT_AREA_ROLES.includes(role));
}

export function hasRole(source: RoleSource, role: MerchantRole): boolean {
  return resolveUserRoles(source).includes(role);
}

export function hasAnyRole(
  source: RoleSource,
  requiredRoles: MerchantRole[],
): boolean {
  const roles = resolveUserRoles(source);
  return requiredRoles.some((role) => roles.includes(role));
}

export function isAdminOnlyUser(source: RoleSource): boolean {
  const roles = resolveUserRoles(source);
  return roles.length === 1 && roles[0] === "admin";
}

export function isCashierOnlyUser(source: FeatureSource): boolean {
  const roles = resolveUserRoles(source);
  return roles.length > 0 && !hasMerchantAreaAccess(source);
}

const ADMIN_PUBLIC_PATHS = new Set(["/admin", "/admin/unauthorized"]);

export function canAccessRoute(pathname: string, source: FeatureSource): boolean {
  if (!pathname.startsWith("/admin")) return true;
  if (ADMIN_PUBLIC_PATHS.has(pathname)) {
    return hasMerchantAreaAccess(source);
  }

  const requiredFeature = resolveRouteFeature(pathname);
  if (!requiredFeature) {
    return hasMerchantAreaAccess(source);
  }
  return hasFeature(source, requiredFeature);
}

/** Safe redirect target when a route is denied. */
export function getUnauthorizedFallbackPath(source: FeatureSource): string {
  if (hasMerchantAreaAccess(source)) {
    return "/admin/unauthorized";
  }
  return getAuthenticatedLandingPath(source);
}

/** Landing route after login — first accessible nav route by feature grants. */
export function getAuthenticatedLandingPath(source: FeatureSource): string {
  if (!hasMerchantAreaAccess(source)) return "/dashboard";

  for (const route of LANDING_ROUTE_ORDER) {
    if (canAccessRoute(route, source)) {
      return route;
    }
  }

  return "/admin";
}

export function formatRoleLabel(role: MerchantRole): string {
  return ROLE_LABELS[role];
}

export function formatUserRoles(roles: MerchantRole[]): string {
  return roles.map(formatRoleLabel).join(", ");
}

export function countAdmins(users: Pick<User, "roles">[]): number {
  return users.filter((user) => hasRole(user, "admin")).length;
}

/** True when removing admin from this user would leave the merchant with none. */
export function wouldRemoveLastAdmin(
  user: Pick<User, "id" | "roles">,
  nextRoles: MerchantRole[],
  allUsers: Pick<User, "id" | "roles">[],
): boolean {
  if (!hasRole(user, "admin") || nextRoles.includes("admin")) {
    return false;
  }
  return countAdmins(allUsers) <= 1;
}

export function canAccessNavFeature(
  source: FeatureSource,
  requiredFeature?: string,
): boolean {
  if (!requiredFeature) return true;
  return hasFeature(source, requiredFeature);
}

/** @deprecated Use canAccessNavFeature — kept for transitional imports. */
export function canAccessNavRoles(
  source: FeatureSource,
  requiredFeature?: string,
): boolean {
  return canAccessNavFeature(source, requiredFeature);
}

export { resolveUserFeatures, hasFeature, hasAnyFeature };
