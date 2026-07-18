import {
  resolveRouteFeature,
  ROUTE_FEATURES,
} from "@/lib/auth/feature-routes";
import { getUnauthorizedFallbackPath } from "@/lib/auth/roles";
import type { FeatureSource } from "@/lib/auth/features";

/** Human-readable labels for admin routes (aligned with dashboard nav). */
export const ROUTE_LABELS: Record<string, string> = {
  "/admin/users": "Users",
  "/admin/staff": "Staff",
  "/admin/food-supplies": "Ingredients",
  "/admin/branch-assets": "Assets",
  "/admin/categories": "Categories",
  "/admin/menus": "Menu",
  "/admin/cogs/menu-breakdown": "Menu Breakdown",
  "/admin/cogs/summary": "COGS Summary",
  "/admin/cogs": "COGS",
  "/admin/transactions": "User Transactions",
  "/admin/cash-flow/bep": "BEP",
  "/admin/cash-flow": "Cash Flow Summary",
  "/admin/expenses": "Expenses",
  "/admin/recurring-expenses": "Recurring Expenses",
  "/admin/store-settings": "Receipt Setting",
  "/admin/order-options": "Order Option",
  "/admin/suppliers": "Suppliers",
  "/admin/purchases": "Purchases",
  "/admin/production-requests/new": "New Cook Request",
  "/admin/production-requests": "Cook Request",
  "/admin/role-features": "Privilege Mapping",
};

const ROUTE_PREFIXES = Object.keys(ROUTE_FEATURES).sort(
  (a, b) => b.length - a.length,
);

export interface UnauthorizedAccessContext {
  attemptedPath: string | null;
  requiredFeature: string | null;
  routeLabel: string | null;
}

export function resolveRouteLabel(pathname: string): string | null {
  if (!pathname.startsWith("/admin")) return null;

  const prefix = ROUTE_PREFIXES.find(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  return prefix ? (ROUTE_LABELS[prefix] ?? null) : null;
}

export function buildUnauthorizedRedirectUrl(attemptedPath: string): string {
  const requiredFeature = resolveRouteFeature(attemptedPath);
  const routeLabel = resolveRouteLabel(attemptedPath);
  const params = new URLSearchParams();

  params.set("from", attemptedPath);
  if (requiredFeature) {
    params.set("feature", requiredFeature);
  }
  if (routeLabel) {
    params.set("label", routeLabel);
  }

  return `/admin/unauthorized?${params.toString()}`;
}

export function parseUnauthorizedAccessContext(
  searchParams: URLSearchParams | ReadonlyURLSearchParamsLike,
): UnauthorizedAccessContext {
  const attemptedPath = searchParams.get("from");
  const requiredFeature = searchParams.get("feature");
  const routeLabel = searchParams.get("label");

  return {
    attemptedPath,
    requiredFeature,
    routeLabel,
  };
}

/** Redirect target when a route is denied — includes context when sent to unauthorized. */
export function getUnauthorizedRedirectTarget(
  attemptedPath: string,
  source: FeatureSource,
): string {
  const fallback = getUnauthorizedFallbackPath(source);
  if (fallback === "/admin/unauthorized") {
    return buildUnauthorizedRedirectUrl(attemptedPath);
  }
  return fallback;
}

/** Minimal search-params surface for server and client parsers. */
export interface ReadonlyURLSearchParamsLike {
  get(name: string): string | null;
}

export function shouldShowStaleSessionHint(
  requiredFeature: string | null,
  sessionFeatures: readonly string[],
  freshFeatures: readonly string[],
): boolean {
  if (!requiredFeature) return false;
  if (sessionFeatures.includes(requiredFeature)) return false;
  return freshFeatures.includes(requiredFeature);
}
