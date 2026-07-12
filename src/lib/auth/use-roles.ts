"use client";

import { useMemo } from "react";
import { useAuth } from "@/lib/auth/context";
import type { MerchantRole } from "@/lib/api/types";
import {
  hasAnyRole as checkAnyRole,
  hasRole as checkRole,
  resolveUserRoles,
} from "@/lib/auth/roles";

export function useRoles() {
  const { user } = useAuth();

  return useMemo(() => {
    const roles = resolveUserRoles(user);
    return {
      roles,
      hasRole: (role: MerchantRole) => checkRole(user, role),
      hasAnyRole: (requiredRoles: MerchantRole[]) =>
        checkAnyRole(user, requiredRoles),
    };
  }, [user]);
}
