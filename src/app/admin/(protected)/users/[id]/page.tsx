"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { adminApi } from "@/lib/api/users";
import { ApiError } from "@/lib/api/client";
import type { User } from "@/lib/api/types";
import { formatDate, initials } from "@/lib/utils";
import { UserRoleBadges } from "@/components/admin/user-role-badges";
import { formatUserRoles } from "@/lib/auth/roles";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .getUser(id)
      .then((res) => setUser(res.data))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Failed to load user"),
      )
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/admin/users"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to users
      </Link>

      {loading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : user ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                {initials(user.name)}
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  {user.name}
                  <UserRoleBadges roles={user.roles} />
                </CardTitle>
                <CardDescription>{user.email}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              {[
                ["User ID", user.id],
                ["Email", user.email],
                ["Roles", formatUserRoles(user.roles)],
                ["Created", formatDate(user.created_at)],
                ["Updated", formatDate(user.updated_at)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
