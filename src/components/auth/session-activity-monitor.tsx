"use client";

import { useAuth } from "@/lib/auth/context";
import { useSessionActivityRefresh } from "@/lib/auth/use-session-activity";

/** Keeps the dashboard session alive via activity and scheduled refresh. */
export function SessionActivityMonitor() {
  const { isAuthenticated, isLoading } = useAuth();
  useSessionActivityRefresh(isAuthenticated && !isLoading);
  return null;
}
