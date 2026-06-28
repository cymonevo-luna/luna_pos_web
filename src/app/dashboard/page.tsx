"use client";

import Link from "next/link";
import { ListTodo, CheckCircle2, Clock, ArrowRight, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GreetingCard } from "@/components/dashboard/greeting-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActivityList } from "@/components/dashboard/activity-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const recentActivity = [
  { id: "1", title: "Design Review", time: "2h ago", color: "blue" as const },
  { id: "2", title: "Project Meeting", time: "4h ago", color: "green" as const },
  {
    id: "3",
    title: "Update Documentation",
    time: "1d ago",
    color: "amber" as const,
  },
];

export default function DashboardHomePage() {
  const { user, isAdmin } = useAuth();
  if (!user) return null;

  const firstName = user.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <GreetingCard name={firstName} />

      <section>
        <h2 className="mb-3 text-base font-semibold">Overview</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Total Tasks"
            value={24}
            icon={ListTodo}
            color="blue"
            trend="+12%"
          />
          <StatCard
            label="Completed"
            value={16}
            icon={CheckCircle2}
            color="green"
            trend="+8%"
          />
          <StatCard
            label="In Progress"
            value={8}
            icon={Clock}
            color="amber"
            trend="-4%"
            trendUp={false}
          />
        </div>
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </CardHeader>
        <CardContent>
          <ActivityList items={recentActivity} />
        </CardContent>
      </Card>

      {isAdmin && (
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

      <button
        type="button"
        aria-label="Create new"
        className="fixed bottom-20 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 md:bottom-8 md:right-8"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
