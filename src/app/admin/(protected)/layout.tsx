"use client";

import { LayoutDashboard, Users, Package, Truck, ShoppingCart, Tags, UtensilsCrossed, Receipt, Calculator, ArrowLeft, Printer } from "lucide-react";
import {
  DashboardShell,
  type NavItem,
} from "@/components/layout/dashboard-shell";
import { RequireAuth } from "@/components/layout/require-auth";

const navItems: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/food-supplies", label: "Food Supplies", icon: Package },
  { href: "/admin/suppliers", label: "Suppliers", icon: Truck },
  { href: "/admin/purchases", label: "Purchases", icon: ShoppingCart },
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/menus", label: "Menus", icon: UtensilsCrossed },
  { href: "/admin/cogs", label: "COGS", icon: Calculator },
  { href: "/admin/transactions", label: "Transactions", icon: Receipt },
  { href: "/admin/store-settings", label: "Receipt Settings", icon: Printer },
  { href: "/dashboard", label: "Back to app", icon: ArrowLeft },
];

export default function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth admin>
      <DashboardShell navItems={navItems} title="Admin Console">
        {children}
      </DashboardShell>
    </RequireAuth>
  );
}
