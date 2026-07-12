"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import {
  hasMerchantAreaAccess,
  isCashierOnlyUser,
} from "@/lib/auth/roles";
import { useRoles } from "@/lib/auth/use-roles";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GreetingCard } from "@/components/dashboard/greeting-card";
import { CashierSummaryStats } from "@/components/dashboard/cashier-summary-stats";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardHomePage() {
  const { user, isAdmin } = useAuth();
  const { hasRole } = useRoles();
  if (!user) return null;

  const firstName = user.name.split(" ")[0];
  const showCashierSummary = hasRole("cashier");
  const showMerchantDashboard = hasMerchantAreaAccess(user);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <GreetingCard
        name={firstName}
        message="Welcome to Luna POS. Track today's sales or open the mobile app to take orders."
      />

      {showCashierSummary && (
        <section>
          <h2 className="mb-3 text-base font-semibold">Summary</h2>
          <CashierSummaryStats />
        </section>
      )}

      {showMerchantDashboard && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">POS Dashboard</CardTitle>
            <CardDescription>
              Manage menus, transactions, suppliers, and more from the merchant
              console.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin" className={buttonVariants()}>
              Open POS Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      )}

      {isCashierOnlyUser(user) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">POS mobile app</CardTitle>
            <CardDescription>
              Cashier accounts use the Luna POS mobile app for selling. Sign in
              there to take orders and process payments.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {isAdmin && !isCashierOnlyUser(user) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Admin access <Badge variant="success">admin</Badge>
            </CardTitle>
            <CardDescription>
              You have elevated permissions. Manage users from the admin console.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin" className={buttonVariants()}>
              Open admin console
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
