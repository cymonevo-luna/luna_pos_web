"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, ArrowRight, ShieldCheck, Activity, Database } from "lucide-react";
import { adminApi } from "@/lib/api/users";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  { id: "1", title: "New user registered", time: "5m ago", color: "blue" as const },
  { id: "2", title: "Role updated to admin", time: "1h ago", color: "purple" as const },
  { id: "3", title: "User account deleted", time: "3h ago", color: "red" as const },
  { id: "4", title: "Database backup completed", time: "6h ago", color: "green" as const },
];

export default function AdminOverviewPage() {
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    adminApi
      .listUsers({ page: 1, perPage: 1 })
      .then((res) => setTotal(res.meta?.total ?? 0))
      .catch(() => setError(true));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Overview</h2>
        <p className="text-sm text-muted-foreground">
          Monitor and manage your application.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {total === null && !error ? (
          <Card className="p-4">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="mt-3 h-7 w-16" />
            <Skeleton className="mt-2 h-4 w-20" />
          </Card>
        ) : (
          <StatCard
            label="Total users"
            value={error ? "—" : (total ?? 0)}
            icon={Users}
            color="blue"
            trend="+12%"
          />
        )}
        <StatCard label="Admins" value={2} icon={ShieldCheck} color="purple" />
        <StatCard
          label="Active today"
          value={18}
          icon={Activity}
          color="green"
          trend="+8%"
        />
        <StatCard label="Storage" value="64%" icon={Database} color="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityList items={recentActivity} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">User management</CardTitle>
            <CardDescription>View, search, and remove users.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/admin/users"
              className={buttonVariants({ className: "w-full" })}
            >
              Manage users
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
