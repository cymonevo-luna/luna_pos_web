"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import {
  canAccessRoute,
  getUnauthorizedFallbackPath,
  resolveUserRoles,
} from "@/lib/auth/roles";

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

export function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const userRoles = resolveUserRoles(user);
  const allowed = canAccessRoute(pathname, userRoles);

  useEffect(() => {
    if (isLoading || !user || allowed) return;
    router.replace(getUnauthorizedFallbackPath(user));
  }, [isLoading, user, allowed, router]);

  if (isLoading || !allowed) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
