import type { MerchantRole, User } from "@/lib/api/types";
import type { JwtPayload } from "@/lib/auth/tokens";
import { ADMIN_AREA_FEATURES } from "@/lib/auth/feature-routes";

export type FeatureSource =
  | Pick<User, "roles" | "features">
  | JwtPayload
  | { roles?: MerchantRole[]; features?: string[] }
  | null
  | undefined;

let legacyFallbackWarned = false;

/** Default backend grants per role — used when `features` is missing or empty. */
export const DEFAULT_ROLE_FEATURES: Record<MerchantRole, readonly string[]> = {
  admin: [
    "users.manage",
    "staff.manage",
    "production_requests.view",
    "role_features.manage",
  ],
  manager: [
    "food_supplies.manage",
    "branch_assets.manage",
    "categories.manage",
    "menus.manage",
    "cogs.view",
    "transactions.view",
    "insights.cash_flow",
    "expenses.manage",
    "recurring_expenses.manage",
    "store_settings.manage",
    "order_options.manage",
    "production_requests.view",
    "production_requests.manage",
  ],
  operational: [
    "food_supplies.manage",
    "expenses.manage",
    "recurring_expenses.manage",
    "suppliers.manage",
    "purchases.manage",
    "production_requests.view",
  ],
  cashier: [],
};

function warnLegacyFallback() {
  if (legacyFallbackWarned || typeof console === "undefined") return;
  legacyFallbackWarned = true;
  console.warn(
    "[auth] user.features missing or empty — falling back to legacy role-based grants",
  );
}

function resolveRoles(source: FeatureSource): MerchantRole[] {
  if (!source) return [];
  return source.roles ?? [];
}

function featuresFromRoles(roles: MerchantRole[]): string[] {
  const features = new Set<string>();
  for (const role of roles) {
    for (const feature of DEFAULT_ROLE_FEATURES[role] ?? []) {
      features.add(feature);
    }
  }
  return [...features];
}

/**
 * Resolve effective feature grants from API user, JWT claims, or legacy roles.
 * When `features` is an explicit array (including empty), API grants are authoritative.
 * Legacy role defaults apply only when `features` is unavailable (pre-migration sessions).
 */
export function resolveUserFeatures(source: FeatureSource): string[] {
  if (!source) return [];

  if (Array.isArray(source.features)) {
    return source.features;
  }

  const roles = resolveRoles(source);
  if (roles.length === 0) {
    return [];
  }

  warnLegacyFallback();
  return featuresFromRoles(roles);
}

export function hasFeature(source: FeatureSource, key: string): boolean {
  return resolveUserFeatures(source).includes(key);
}

export function hasAnyFeature(source: FeatureSource, keys: string[]): boolean {
  const features = resolveUserFeatures(source);
  return keys.some((key) => features.includes(key));
}

export function hasAdminAreaFeatureAccess(source: FeatureSource): boolean {
  const features = resolveUserFeatures(source);
  return features.some((feature) => ADMIN_AREA_FEATURES.has(feature));
}
