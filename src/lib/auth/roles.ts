import type { JwtPayload } from "@/lib/auth/tokens";
import type { MerchantRole, User } from "@/lib/api/types";

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
];

const ROLE_LABELS: Record<MerchantRole, string> = {
  admin: "Admin",
  manager: "Manager",
  cashier: "Cashier",
  operational: "Operational",
};

type RoleSource = Pick<User, "roles"> | JwtPayload | null | undefined;

/** Resolve effective merchant roles from API user or JWT claims. */
export function resolveUserRoles(source: RoleSource): MerchantRole[] {
  if (!source) return [];
  return source.roles ?? [];
}

export function hasMerchantAreaAccess(source: RoleSource): boolean {
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

export function isCashierOnlyUser(source: RoleSource): boolean {
  const roles = resolveUserRoles(source);
  return roles.length > 0 && !hasMerchantAreaAccess(source);
}

type AdminRouteRule = {
  prefix: string;
  roles: MerchantRole[];
};

/** Per-route RBAC aligned with backend scopes. Longest-prefix wins. */
const ADMIN_ROUTE_RULES: AdminRouteRule[] = [
  { prefix: "/admin/users", roles: ["admin"] as const },
  { prefix: "/admin/food-supplies", roles: ["manager", "operational"] as const },
  { prefix: "/admin/branch-assets", roles: ["manager"] as const },
  { prefix: "/admin/categories", roles: ["manager"] as const },
  { prefix: "/admin/menus", roles: ["manager"] as const },
  { prefix: "/admin/cogs", roles: ["manager"] as const },
  { prefix: "/admin/transactions", roles: ["manager"] as const },
  { prefix: "/admin/cash-flow", roles: ["manager"] as const },
  { prefix: "/admin/store-settings", roles: ["manager"] as const },
  { prefix: "/admin/suppliers", roles: ["operational"] as const },
  { prefix: "/admin/purchases", roles: ["operational"] as const },
  { prefix: "/admin/production-requests/new", roles: ["manager"] as const },
  { prefix: "/admin/production-requests", roles: ["manager", "operational"] as const },
].map((rule) => ({
  prefix: rule.prefix,
  roles: [...rule.roles] as MerchantRole[],
})).sort((a, b) => b.prefix.length - a.prefix.length);

const ADMIN_PUBLIC_PATHS = new Set(["/admin", "/admin/unauthorized"]);

export function canAccessRoute(
  pathname: string,
  userRoles: MerchantRole[],
): boolean {
  if (!pathname.startsWith("/admin")) return true;
  if (ADMIN_PUBLIC_PATHS.has(pathname)) {
    return hasMerchantAreaAccess({ roles: userRoles });
  }

  const rule = ADMIN_ROUTE_RULES.find(
    (entry) =>
      pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`),
  );
  if (!rule) return hasMerchantAreaAccess({ roles: userRoles });
  return hasAnyRole({ roles: userRoles }, rule.roles);
}

/** Safe redirect target when a route is denied. */
export function getUnauthorizedFallbackPath(source: RoleSource): string {
  return getAuthenticatedLandingPath(source);
}

/** Landing route after login or auth-page redirect (highest-priority area). */
export function getAuthenticatedLandingPath(source: RoleSource): string {
  if (!hasMerchantAreaAccess(source)) return "/dashboard";
  if (hasAnyRole(source, ["manager"])) return "/admin";
  if (isAdminOnlyUser(source)) return "/admin/users";
  if (hasAnyRole(source, ["operational"])) return "/admin/suppliers";
  if (hasAnyRole(source, ["admin"])) return "/admin/users";
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

export function canAccessNavRoles(
  userRoles: MerchantRole[],
  requiredRoles?: MerchantRole[],
): boolean {
  if (!requiredRoles?.length) return true;
  return requiredRoles.some((role) => userRoles.includes(role));
}
