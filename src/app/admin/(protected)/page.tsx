"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { useRoles } from "@/lib/auth/use-roles";
import { overviewCards } from "@/lib/dashboard/quick-actions";
import { buttonVariants } from "@/components/ui/button";
import { GreetingCard } from "@/components/dashboard/greeting-card";
import { DashboardSummaryStats } from "@/components/dashboard/dashboard-summary-stats";
import { CashFlowOverviewStats } from "@/components/dashboard/cash-flow-overview-stats";
import { RecentTransactionsPanel } from "@/components/dashboard/recent-transactions-panel";
import { TransactionSummaryChart } from "@/components/admin/transaction-summary-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminOverviewPage() {
  const { user } = useAuth();
  const { roles, hasAnyRole, hasRole } = useRoles();

  if (!user) return null;

  const firstName = user.name.split(" ")[0];
  const visibleCards = overviewCards.filter((card) => hasAnyRole(card.roles));
  const isManager = hasRole("manager");
  const showSummary = hasAnyRole(["manager", "admin", "operational"]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <GreetingCard
        name={firstName}
        message="Welcome to your POS dashboard"
      />

      {showSummary && (
        <section aria-labelledby="summary-heading">
          <h2 id="summary-heading" className="mb-3 text-base font-semibold">
            Summary
          </h2>
          <DashboardSummaryStats roles={roles} />
          {isManager && <CashFlowOverviewStats />}
        </section>
      )}

      {isManager && (
        <section aria-labelledby="analytics-heading">
          <h2 id="analytics-heading" className="mb-3 text-base font-semibold">
            Analytics
          </h2>
          <TransactionSummaryChart />
        </section>
      )}

      <section aria-labelledby="quick-actions-heading">
        <h2
          id="quick-actions-heading"
          className="mb-3 text-base font-semibold"
        >
          Quick actions
        </h2>
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
                <Card
                  key={card.href}
                  className="transition-shadow hover:shadow-md"
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </span>
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
      </section>

      {isManager && <RecentTransactionsPanel />}
    </div>
  );
}
