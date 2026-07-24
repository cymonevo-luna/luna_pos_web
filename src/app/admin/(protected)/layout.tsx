"use client";

import {
  LayoutDashboard,
  Users,
  UserCog,
  Package,
  Box,
  Truck,
  ShoppingCart,
  ChefHat,
  Tags,
  UtensilsCrossed,
  Receipt,
  Calculator,
  ArrowLeft,
  Printer,
  TrendingUp,
  Repeat,
  ListOrdered,
  Wallet,
  Trash2,
  Building2,
  KeyRound,
} from "lucide-react";
import {
  DashboardShell,
  isNavGroup,
  type NavEntry,
  type NavItem,
} from "@/components/layout/dashboard-shell";
import { AdminRouteGuard } from "@/components/layout/admin-route-guard";
import { RequireAuth } from "@/components/layout/require-auth";
import { useAuth } from "@/lib/auth/context";
import { canAccessNavFeature } from "@/lib/auth/roles";
import type { FeatureSource } from "@/lib/auth/features";

export const allNavItems: NavEntry[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  {
    label: "Food",
    icon: UtensilsCrossed,
    children: [
      {
        href: "/admin/food-supplies",
        label: "Ingredients",
        icon: Package,
        feature: "food_supplies.manage",
      },
      {
        href: "/admin/categories",
        label: "Categories",
        icon: Tags,
        feature: "categories.manage",
      },
      {
        href: "/admin/menus",
        label: "Menu",
        icon: UtensilsCrossed,
        feature: "menus.manage",
      },
      {
        href: "/admin/production-requests",
        label: "Cook Request",
        icon: ChefHat,
        feature: "production_requests.view",
      },
      {
        href: "/admin/transactions",
        label: "User Transactions",
        icon: Receipt,
        feature: "transactions.view",
      },
      {
        href: "/admin/menu-disposals",
        label: "Menu Disposals",
        icon: Trash2,
        feature: "menu_disposals.view",
      },
    ],
  },
  {
    label: "Supplier",
    icon: Truck,
    children: [
      {
        href: "/admin/suppliers",
        label: "List",
        icon: Truck,
        feature: "suppliers.manage",
      },
      {
        href: "/admin/purchases",
        label: "Purchases",
        icon: ShoppingCart,
        feature: "purchases.manage",
      },
    ],
  },
  {
    label: "COGS",
    icon: Calculator,
    children: [
      {
        href: "/admin/cogs/menu-breakdown",
        label: "Menu Breakdown",
        icon: Calculator,
        feature: "cogs.view",
      },
      {
        href: "/admin/cogs/summary",
        label: "Summary",
        icon: Calculator,
        feature: "cogs.view",
      },
    ],
  },
  {
    label: "Cash Flow",
    icon: TrendingUp,
    children: [
      {
        href: "/admin/cashier-balance",
        label: "Cashier Balance",
        icon: Wallet,
        feature: "cashier_balance.manage",
      },
      {
        href: "/admin/cash-flow/bep",
        label: "BEP",
        icon: TrendingUp,
        feature: "insights.cash_flow",
      },
      {
        href: "/admin/cash-flow",
        label: "Summary",
        icon: TrendingUp,
        feature: "insights.cash_flow",
      },
      {
        href: "/admin/expenses",
        label: "Expenses",
        icon: Wallet,
        feature: "expenses.manage",
      },
      {
        href: "/admin/recurring-expenses",
        label: "Recurring Expenses",
        icon: Repeat,
        feature: "recurring_expenses.manage",
      },
    ],
  },
  {
    label: "Branch",
    icon: Building2,
    children: [
      {
        href: "/admin/users",
        label: "Users",
        icon: Users,
        feature: "users.manage",
      },
      {
        href: "/admin/staff",
        label: "Staff",
        icon: UserCog,
        feature: "staff.manage",
      },
      {
        href: "/admin/role-features",
        label: "Privilege Mapping",
        icon: KeyRound,
        feature: "role_features.manage",
      },
      {
        href: "/admin/branch-assets",
        label: "Assets",
        icon: Box,
        feature: "branch_assets.manage",
      },
      {
        href: "/admin/order-options",
        label: "Order Option",
        icon: ListOrdered,
        feature: "order_options.manage",
      },
      {
        href: "/admin/store-settings",
        label: "Receipt Setting",
        icon: Printer,
        feature: "store_settings.manage",
      },
    ],
  },
  { href: "/dashboard", label: "Back to app", icon: ArrowLeft },
];

export function filterAdminNavItems(
  items: NavEntry[],
  source: FeatureSource,
): NavEntry[] {
  return items
    .map((entry) => {
      if (isNavGroup(entry)) {
        const children = entry.children.filter((child) =>
          canAccessNavFeature(source, child.feature),
        );
        if (children.length === 0) {
          return null;
        }
        return { ...entry, children };
      }
      return canAccessNavFeature(source, entry.feature) ? entry : null;
    })
    .filter((entry): entry is NavEntry => entry !== null);
}

export function flattenAdminNavLabels(items: NavEntry[]): string[] {
  const labels: string[] = [];
  for (const entry of items) {
    if (isNavGroup(entry)) {
      labels.push(entry.label);
      for (const child of entry.children) {
        labels.push(child.label);
      }
      continue;
    }
    labels.push(entry.label);
  }
  return labels;
}

export default function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const navItems = filterAdminNavItems(allNavItems, user);

  return (
    <RequireAuth admin>
      <AdminRouteGuard>
        <DashboardShell navItems={navItems} title="POS Dashboard">
          {children}
        </DashboardShell>
      </AdminRouteGuard>
    </RequireAuth>
  );
}
