"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/context";

interface RequireAuthProps {
  children: React.ReactNode;
  /** When true, also require the admin role. */
  admin?: boolean;
}

export function RequireAuth({ children, admin = false }: RequireAuthProps) {
  const { isLoading, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace(admin ? "/admin/login" : "/login");
    } else if (admin && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, isAdmin, admin, router]);

  if (isLoading || !isAuthenticated || (admin && !isAdmin)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
