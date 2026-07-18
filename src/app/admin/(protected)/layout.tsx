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
  Building2,
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
import {
  canAccessNavRoles,
  resolveUserRoles,
} from "@/lib/auth/roles";
import type { MerchantRole } from "@/lib/api/types";

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
        roles: ["manager", "operational"],
      },
      {
        href: "/admin/categories",
        label: "Categories",
        icon: Tags,
        roles: ["manager"],
      },
      {
        href: "/admin/menus",
        label: "Menu",
        icon: UtensilsCrossed,
        roles: ["manager"],
      },
      {
        href: "/admin/production-requests",
        label: "Cook Request",
        icon: ChefHat,
        roles: ["admin", "manager", "operational"],
      },
      {
        href: "/admin/transactions",
        label: "User Transactions",
        icon: Receipt,
        roles: ["manager"],
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
        roles: ["operational"],
      },
      {
        href: "/admin/purchases",
        label: "Purchases",
        icon: ShoppingCart,
        roles: ["operational"],
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
        roles: ["manager"],
      },
      {
        href: "/admin/cogs/summary",
        label: "Summary",
        icon: Calculator,
        roles: ["manager"],
      },
    ],
  },
  {
    label: "Cash Flow",
    icon: TrendingUp,
    children: [
      {
        href: "/admin/expenses",
        label: "Expenses",
        icon: Wallet,
        roles: ["manager", "operational"],
      },
      {
        href: "/admin/recurring-expenses",
        label: "Recurring Expenses",
        icon: Repeat,
        roles: ["manager", "operational"],
      },
      {
        href: "/admin/cash-flow/bep",
        label: "BEP",
        icon: TrendingUp,
        roles: ["manager"],
      },
      {
        href: "/admin/cash-flow",
        label: "Summary",
        icon: TrendingUp,
        roles: ["manager"],
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
        roles: ["admin"],
      },
      {
        href: "/admin/staff",
        label: "Staff",
        icon: UserCog,
        roles: ["admin"],
      },
      {
        href: "/admin/branch-assets",
        label: "Assets",
        icon: Box,
        roles: ["manager"],
      },
      {
        href: "/admin/order-options",
        label: "Order Option",
        icon: ListOrdered,
        roles: ["manager"],
      },
      {
        href: "/admin/store-settings",
        label: "Receipt Setting",
        icon: Printer,
        roles: ["manager"],
      },
    ],
  },
  { href: "/dashboard", label: "Back to app", icon: ArrowLeft },
];

export function filterAdminNavItems(
  items: NavEntry[],
  userRoles: MerchantRole[],
): NavEntry[] {
  return items
    .map((entry) => {
      if (isNavGroup(entry)) {
        const children = entry.children.filter((child) =>
          canAccessNavRoles(userRoles, child.roles),
        );
        if (children.length === 0) {
          return null;
        }
        return { ...entry, children };
      }
      return canAccessNavRoles(userRoles, entry.roles) ? entry : null;
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
  const navItems = filterAdminNavItems(allNavItems, resolveUserRoles(user));

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
