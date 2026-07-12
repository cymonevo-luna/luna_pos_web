"use client";

import { LayoutDashboard, Users, Package, Truck, ShoppingCart, Tags, UtensilsCrossed, Receipt, Calculator, ArrowLeft, Printer } from "lucide-react";
import {
  DashboardShell,
  type NavItem,
} from "@/components/layout/dashboard-shell";
import { RequireAuth } from "@/components/layout/require-auth";
import { useAuth } from "@/lib/auth/context";
import {
  canAccessNavRoles,
  resolveUserRoles,
} from "@/lib/auth/roles";
import type { MerchantRole } from "@/lib/api/types";

const allNavItems: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, roles: ["admin", "manager"] },
  { href: "/admin/users", label: "Users", icon: Users, roles: ["admin"] },
  { href: "/admin/food-supplies", label: "Food Supplies", icon: Package, roles: ["manager", "operational"] },
  { href: "/admin/suppliers", label: "Suppliers", icon: Truck, roles: ["manager", "operational"] },
  { href: "/admin/purchases", label: "Purchases", icon: ShoppingCart, roles: ["manager", "operational"] },
  { href: "/admin/categories", label: "Categories", icon: Tags, roles: ["manager", "operational"] },
  { href: "/admin/menus", label: "Menus", icon: UtensilsCrossed, roles: ["manager", "operational"] },
  { href: "/admin/cogs", label: "COGS", icon: Calculator, roles: ["manager", "operational"] },
  { href: "/admin/transactions", label: "Transactions", icon: Receipt, roles: ["manager", "operational"] },
  { href: "/admin/store-settings", label: "Receipt Settings", icon: Printer, roles: ["admin", "manager"] },
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
      <DashboardShell navItems={navItems} title="Admin Console">
        {children}
      </DashboardShell>
    </RequireAuth>
  );
}
