"use client";

import { LayoutDashboard, User, Settings } from "lucide-react";
import {
  DashboardShell,
  type NavItem,
} from "@/components/layout/dashboard-shell";
import { RequireAuth } from "@/components/layout/require-auth";

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <DashboardShell navItems={navItems} title="Dashboard">
        {children}
      </DashboardShell>
    </RequireAuth>
  );
}
