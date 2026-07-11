"use client";

import { LayoutDashboard, Users, Package, Tags, ArrowLeft } from "lucide-react";
import {
  DashboardShell,
  type NavItem,
} from "@/components/layout/dashboard-shell";
import { RequireAuth } from "@/components/layout/require-auth";

const navItems: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/food-supplies", label: "Food Supplies", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: Tags },
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
