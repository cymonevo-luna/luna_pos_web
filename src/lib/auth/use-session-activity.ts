import { useCallback, useEffect, useRef } from "react";
import {
  ACTIVITY_REFRESH_DEBOUNCE_MS,
  ACCESS_REFRESH_BUFFER_SECONDS,
  isRefreshValid,
} from "@/lib/auth/token-helpers";
import {
  isLoginRoute,
  performSessionRefresh,
} from "@/lib/auth/session-refresh";
import { tokenStore } from "@/lib/auth/tokens";

function msUntilProactiveRefresh(now = Date.now()): number | null {
  const expiresAt = tokenStore.accessExpiresAt;
  if (!expiresAt) return null;
  return expiresAt - now - ACCESS_REFRESH_BUFFER_SECONDS * 1000;
}

/**
 * Extends the session on user activity and via a scheduled timer when the
 * access token nears expiry (idle viewing).
 */
export function useSessionActivityRefresh(enabled: boolean): void {
  const lastActivityRefreshRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRef = useRef<() => void>(() => undefined);

  const clearScheduledRefresh = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleProactiveRefresh = useCallback(() => {
    clearScheduledRefresh();
    if (!enabled || isLoginRoute() || !isRefreshValid()) return;

    const delay = msUntilProactiveRefresh();
    if (delay === null) return;

    if (delay <= 0) {
      void performSessionRefresh().finally(() => scheduleRef.current());
      return;
    }

    timerRef.current = setTimeout(() => {
      if (
        enabled &&
        !isLoginRoute() &&
        isRefreshValid() &&
        document.visibilityState !== "hidden"
      ) {
        void performSessionRefresh().finally(() => scheduleRef.current());
      } else {
        scheduleRef.current();
      }
    }, delay);
  }, [enabled, clearScheduledRefresh]);

  const refreshOnActivity = useCallback(() => {
    if (!enabled || isLoginRoute()) return;
    if (document.visibilityState === "hidden") return;
    if (!isRefreshValid()) return;

    const now = Date.now();
    if (now - lastActivityRefreshRef.current < ACTIVITY_REFRESH_DEBOUNCE_MS) {
      return;
    }

    lastActivityRefreshRef.current = now;
    void performSessionRefresh().finally(() => scheduleRef.current());
  }, [enabled]);

  useEffect(() => {
    scheduleRef.current = scheduleProactiveRefresh;

    if (!enabled) {
      clearScheduledRefresh();
      return;
    }

    const activityEvents = ["click", "keydown", "mousemove"] as const;
    for (const eventName of activityEvents) {
      window.addEventListener(eventName, refreshOnActivity, { passive: true });
    }

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (!enabled || isLoginRoute() || !isRefreshValid()) return;
      void performSessionRefresh().finally(() => scheduleRef.current());
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    scheduleProactiveRefresh();

    return () => {
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, refreshOnActivity);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearScheduledRefresh();
    };
  }, [
    enabled,
    refreshOnActivity,
    scheduleProactiveRefresh,
    clearScheduledRefresh,
  ]);
}
