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
  Wallet,
} from "lucide-react";
import {
  DashboardShell,
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

const allNavItems: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users, roles: ["admin"] },
  { href: "/admin/staff", label: "Staff", icon: UserCog, roles: ["admin"] },
  { href: "/admin/food-supplies", label: "Food Supplies", icon: Package, roles: ["manager", "operational"] },
  { href: "/admin/branch-assets", label: "Branch Assets", icon: Box, roles: ["manager"] },
  { href: "/admin/categories", label: "Categories", icon: Tags, roles: ["manager"] },
  { href: "/admin/menus", label: "Menus", icon: UtensilsCrossed, roles: ["manager"] },
  { href: "/admin/cogs", label: "COGS", icon: Calculator, roles: ["manager"] },
  { href: "/admin/transactions", label: "Transactions", icon: Receipt, roles: ["manager"] },
  { href: "/admin/cash-flow", label: "Cash Flow", icon: TrendingUp, roles: ["manager"] },
  { href: "/admin/expenses", label: "Expenses", icon: Wallet, roles: ["manager", "operational"] },
  { href: "/admin/recurring-expenses", label: "Recurring Expenses", icon: Repeat, roles: ["manager", "operational"] },
  { href: "/admin/store-settings", label: "Receipt Settings", icon: Printer, roles: ["manager"] },
  { href: "/admin/suppliers", label: "Suppliers", icon: Truck, roles: ["operational"] },
  { href: "/admin/purchases", label: "Purchases", icon: ShoppingCart, roles: ["operational"] },
  { href: "/admin/production-requests", label: "Production", icon: ChefHat, roles: ["admin", "manager", "operational"] },
  { href: "/dashboard", label: "Back to app", icon: ArrowLeft },
];

export function filterAdminNavItems(
  items: NavItem[],
  userRoles: MerchantRole[],
): NavItem[] {
  return items.filter((item) => canAccessNavRoles(userRoles, item.roles));
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
