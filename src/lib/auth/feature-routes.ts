/** Central route → feature registry (keep in sync with backend). */
export const ROUTE_FEATURES: Record<string, string> = {
  "/admin/users": "users.manage",
  "/admin/staff": "staff.manage",
  "/admin/food-supplies": "food_supplies.manage",
  "/admin/branch-assets": "branch_assets.manage",
  "/admin/categories": "categories.manage",
  "/admin/menus": "menus.manage",
  "/admin/cogs/menu-breakdown": "cogs.view",
  "/admin/cogs/summary": "cogs.view",
  "/admin/cogs": "cogs.view",
  "/admin/transactions": "transactions.view",
  "/admin/menu-disposals": "menu_disposals.view",
  "/admin/cash-flow/bep": "insights.cash_flow",
  "/admin/cash-flow": "insights.cash_flow",
  "/admin/expenses": "expenses.manage",
  "/admin/recurring-expenses": "recurring_expenses.manage",
  "/admin/cashier-balance": "cashier_balance.manage",
  "/admin/store-settings": "store_settings.manage",
  "/admin/order-options": "order_options.manage",
  "/admin/suppliers": "suppliers.manage",
  "/admin/purchases": "purchases.manage",
  "/admin/production-requests/new": "production_requests.manage",
  "/admin/production-requests": "production_requests.view",
  "/admin/role-features": "role_features.manage",
};

const ROUTE_PREFIXES = Object.keys(ROUTE_FEATURES).sort(
  (a, b) => b.length - a.length,
);

/** All feature keys that grant access to some admin route. */
export const ADMIN_AREA_FEATURES = new Set(Object.values(ROUTE_FEATURES));

/** Ordered routes used to pick the first accessible landing page. */
export const LANDING_ROUTE_ORDER = [
  "/admin/users",
  "/admin/staff",
  "/admin/food-supplies",
  "/admin/suppliers",
  "/admin/purchases",
  "/admin/menus",
  "/admin/categories",
  "/admin/cogs/menu-breakdown",
  "/admin/transactions",
  "/admin/menu-disposals",
  "/admin/cash-flow",
  "/admin/expenses",
  "/admin/cashier-balance",
  "/admin/production-requests",
  "/admin/branch-assets",
  "/admin/role-features",
  "/admin",
] as const;

export function resolveRouteFeature(pathname: string): string | null {
  if (!pathname.startsWith("/admin")) return null;

  const prefix = ROUTE_PREFIXES.find(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  return prefix ? ROUTE_FEATURES[prefix] : null;
}
