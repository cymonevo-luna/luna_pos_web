import type { JwtPayload } from "@/lib/auth/tokens";
import type { MerchantRole, User } from "@/lib/api/types";

const MERCHANT_AREA_ROLES: MerchantRole[] = ["admin", "manager", "operational"];

/** Resolve effective merchant roles from API user or JWT claims. */
export function resolveUserRoles(
  source: Pick<User, "roles"> | JwtPayload | null | undefined,
): MerchantRole[] {
  if (!source) return [];
  return source.roles ?? [];
}

export function hasMerchantAreaAccess(
  source: Pick<User, "roles"> | JwtPayload | null | undefined,
): boolean {
  const roles = resolveUserRoles(source);
  return roles.some((role) => MERCHANT_AREA_ROLES.includes(role));
}

export function isAdminOnlyUser(
  source: Pick<User, "roles"> | JwtPayload | null | undefined,
): boolean {
  const roles = resolveUserRoles(source);
  return roles.length === 1 && roles[0] === "admin";
}

/** Landing route after merchant registration or auth-page redirect. */
export function getAuthenticatedLandingPath(
  source: Pick<User, "roles"> | JwtPayload | null | undefined,
): string {
  if (!hasMerchantAreaAccess(source)) return "/dashboard";
  if (isAdminOnlyUser(source)) return "/admin/users";
  return "/admin";
}

export function formatUserRoles(roles: MerchantRole[]): string {
  return roles.join(", ");
}

export function canAccessNavRoles(
  userRoles: MerchantRole[],
  requiredRoles?: MerchantRole[],
): boolean {
  if (!requiredRoles?.length) return true;
  return requiredRoles.some((role) => userRoles.includes(role));
}
