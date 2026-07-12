import { config } from "@/lib/config";
import type { MerchantRole, Role } from "@/lib/api/types";
import {
  ACCESS_COOKIE_MAX_AGE,
  REFRESH_COOKIE_MAX_AGE,
} from "@/lib/auth/session";

/**
 * Lightweight cookie-based token storage. Tokens are stored in readable cookies
 * (not httpOnly) so the same session is visible to client components and to the
 * Next.js middleware for route protection.
 *
 * SECURITY NOTE: For production, prefer moving token handling behind a BFF that
 * sets httpOnly + Secure cookies. See the README recommendations.
 */

const isBrowser = () => typeof document !== "undefined";

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (!isBrowser()) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function deleteCookie(name: string) {
  if (!isBrowser()) return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function readCookie(name: string): string | null {
  if (!isBrowser()) return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

export const tokenStore = {
  get access() {
    return readCookie(config.cookies.accessToken);
  },
  get refresh() {
    return readCookie(config.cookies.refreshToken);
  },
  set(accessToken: string, refreshToken: string) {
    setCookie(config.cookies.accessToken, accessToken, ACCESS_COOKIE_MAX_AGE);
    setCookie(config.cookies.refreshToken, refreshToken, REFRESH_COOKIE_MAX_AGE);
  },
  clear() {
    deleteCookie(config.cookies.accessToken);
    deleteCookie(config.cookies.refreshToken);
  },
};

export interface JwtPayload {
  uid: string;
  email: string;
  role: Role;
  roles?: MerchantRole[];
  merchant_id?: string;
  typ: string;
  exp: number;
}

/** Decode a JWT payload without verifying its signature (UX/routing only). */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof atob === "function"
        ? atob(normalized)
        : Buffer.from(normalized, "base64").toString("utf8");
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}
