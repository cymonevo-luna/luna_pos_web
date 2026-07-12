"use client";

import Link from "next/link";
import { ShieldX } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { getUnauthorizedFallbackPath } from "@/lib/auth/roles";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminUnauthorizedPage() {
  const { user } = useAuth();
  const fallback = user ? getUnauthorizedFallbackPath(user) : "/dashboard";

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldX className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Access denied</CardTitle>
          <CardDescription>
            You do not have permission to view this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Link href={fallback} className={buttonVariants()}>
            Go to your dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
