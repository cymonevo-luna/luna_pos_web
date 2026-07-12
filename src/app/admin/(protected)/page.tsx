"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  ArrowRight,
  Calculator,
  Receipt,
  Truck,
  ShoppingCart,
  UtensilsCrossed,
  Tags,
  Package,
  Printer,
} from "lucide-react";
import { adminApi } from "@/lib/api/users";
import { useRoles } from "@/lib/auth/use-roles";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RecentTransactionsPanel } from "@/components/dashboard/recent-transactions-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type OverviewCard = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: ("admin" | "manager" | "operational")[];
};

const overviewCards: OverviewCard[] = [
  {
    title: "User management",
    description: "View, search, and manage merchant users.",
    href: "/admin/users",
    icon: Users,
    roles: ["admin"],
  },
  {
    title: "COGS",
    description: "Review cost of goods sold and menu margins.",
    href: "/admin/cogs",
    icon: Calculator,
    roles: ["manager"],
  },
  {
    title: "Transactions",
    description: "Browse transaction history and details.",
    href: "/admin/transactions",
    icon: Receipt,
    roles: ["manager"],
  },
  {
    title: "Menus",
    description: "Manage menu items and formulas.",
    href: "/admin/menus",
    icon: UtensilsCrossed,
    roles: ["manager"],
  },
  {
    title: "Categories",
    description: "Organize menu categories.",
    href: "/admin/categories",
    icon: Tags,
    roles: ["manager"],
  },
  {
    title: "Food supplies",
    description: "Maintain ingredient inventory.",
    href: "/admin/food-supplies",
    icon: Package,
    roles: ["manager", "operational"],
  },
  {
    title: "Receipt settings",
    description: "Configure store receipt layout.",
    href: "/admin/store-settings",
    icon: Printer,
    roles: ["manager"],
  },
  {
    title: "Suppliers",
    description: "Manage supplier contacts and pricing.",
    href: "/admin/suppliers",
    icon: Truck,
    roles: ["operational"],
  },
  {
    title: "Purchase requests",
    description: "Create and track purchase requests.",
    href: "/admin/purchases",
    icon: ShoppingCart,
    roles: ["operational"],
  },
];

export default function AdminOverviewPage() {
  const { roles, hasAnyRole } = useRoles();
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [usersError, setUsersError] = useState(false);

  const visibleCards = overviewCards.filter((card) => hasAnyRole(card.roles));

  useEffect(() => {
    if (!roles.includes("admin")) return;

    adminApi
      .listUsers({ page: 1, perPage: 1 })
      .then((res) => setTotalUsers(res.meta?.total ?? 0))
      .catch(() => setUsersError(true));
  }, [roles]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Overview</h2>
        <p className="text-sm text-muted-foreground">
          Quick access to the areas available for your account.
        </p>
      </div>

      <RecentTransactionsPanel />

      {hasAnyRole(["admin"]) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total users</CardTitle>
            <CardDescription>Registered users in this merchant.</CardDescription>
          </CardHeader>
          <CardContent>
            {totalUsers === null && !usersError ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-3xl font-bold">
                {usersError ? "—" : (totalUsers ?? 0)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {visibleCards.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No admin areas</CardTitle>
            <CardDescription>
              Your account does not have access to any admin console sections.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.href}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-4 w-4 text-primary" />
                    {card.title}
                  </CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link
                    href={card.href}
                    className={buttonVariants({ className: "w-full" })}
                  >
                    Open
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
