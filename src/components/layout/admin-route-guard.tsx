"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { getUnauthorizedRedirectTarget } from "@/lib/auth/unauthorized-access";
import { canAccessRoute } from "@/lib/auth/roles";

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

export function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const allowed = canAccessRoute(pathname, user);

  useEffect(() => {
    if (isLoading || !user || allowed) return;
    router.replace(getUnauthorizedRedirectTarget(pathname, user));
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
