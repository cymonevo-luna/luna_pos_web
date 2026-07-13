import { refreshTokenPair } from "@/lib/auth/refresh";
import { redirectToLogin } from "@/lib/auth/redirect";
import { clearAuthSession } from "@/lib/auth/session-store";
import {
  isAccessExpiringSoon,
  isRefreshValid,
  setTokens,
} from "@/lib/auth/token-helpers";
import { tokenStore } from "@/lib/auth/tokens";

const AUTH_EXEMPT_API_PATHS = [
  "/api/v1/auth/login",
  "/api/v1/auth/refresh",
  "/api/v1/auth/register",
] as const;

const LOGIN_ROUTES = [
  "/login",
  "/admin/login",
  "/register",
  "/admin/register",
] as const;

/** API paths that must not attach Bearer tokens or trigger refresh retries. */
export function isAuthExemptApiPath(path: string): boolean {
  const normalized = path.replace(/^https?:\/\/[^/]+/, "");
  return AUTH_EXEMPT_API_PATHS.some(
    (exempt) =>
      normalized === exempt || normalized.startsWith(`${exempt}?`),
  );
}

/** Client routes where interceptors must not attach tokens or refresh. */
export function isLoginRoute(pathname?: string): boolean {
  if (typeof window === "undefined") return false;
  const path = pathname ?? window.location.pathname;
  return (LOGIN_ROUTES as readonly string[]).includes(path);
}

/**
 * Exchange the stored refresh token for a new pair.
 * Concurrent callers share the same in-flight promise via refreshTokenPair.
 */
export async function performSessionRefresh(): Promise<boolean> {
  const refresh = tokenStore.refresh;
  if (!refresh || !isRefreshValid()) return false;

  const tokens = await refreshTokenPair(refresh);
  if (!tokens) return false;

  setTokens(tokens);
  return true;
}

/**
 * Ensure a usable access token before a protected API call.
 * Refreshes proactively when access is expired or expiring soon.
 */
export async function ensureFreshAccessToken(): Promise<boolean> {
  if (!isRefreshValid()) return false;

  if (tokenStore.isAccessValid() && !isAccessExpiringSoon()) {
    return true;
  }

  return performSessionRefresh();
}

export function clearSessionAndRedirectToLogin(): void {
  clearAuthSession();
  redirectToLogin();
}
