import { config } from "@/lib/config";
import type { MerchantRole, TokenPair } from "@/lib/api/types";
import {
  ACCESS_COOKIE_MAX_AGE,
  REFRESH_COOKIE_MAX_AGE,
  DEFAULT_REFRESH_TTL_SECONDS,
} from "@/lib/auth/session";

/**
 * Durable token storage in localStorage with cookie mirrors for Next.js middleware.
 * Tokens are readable (not httpOnly) so client components can attach Bearer auth.
 *
 * SECURITY NOTE: For production, prefer moving token handling behind a BFF that
 * sets httpOnly + Secure cookies. See the README recommendations.
 */

const isBrowser = () => typeof window !== "undefined";

function readStorage(key: string): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(key);
}

function writeStorage(key: string, value: string) {
  if (!isBrowser()) return;
  localStorage.setItem(key, value);
}

function removeStorage(key: string) {
  if (!isBrowser()) return;
  localStorage.removeItem(key);
}

function readExpiry(key: string): number | null {
  const raw = readStorage(key);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

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

export interface TokenExpiryMeta {
  expires_in?: number;
  refresh_expires_in?: number;
}

export function computeTokenExpiry(
  meta: TokenExpiryMeta = {},
  now = Date.now(),
): { access_expires_at: number; refresh_expires_at: number } {
  const accessTtlSeconds = meta.expires_in ?? ACCESS_COOKIE_MAX_AGE;
  const refreshTtlSeconds =
    meta.refresh_expires_in ?? DEFAULT_REFRESH_TTL_SECONDS;
  return {
    access_expires_at: now + accessTtlSeconds * 1000,
    refresh_expires_at: now + refreshTtlSeconds * 1000,
  };
}

function cookieMaxAgeFromExpiry(expiresAt: number | null, fallback: number): number {
  if (!expiresAt) return fallback;
  const remaining = Math.floor((expiresAt - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

function syncCookies(
  accessToken: string,
  refreshToken: string,
  accessExpiresAt: number,
  refreshExpiresAt: number,
) {
  setCookie(
    config.cookies.accessToken,
    accessToken,
    cookieMaxAgeFromExpiry(accessExpiresAt, ACCESS_COOKIE_MAX_AGE),
  );
  setCookie(
    config.cookies.refreshToken,
    refreshToken,
    cookieMaxAgeFromExpiry(refreshExpiresAt, REFRESH_COOKIE_MAX_AGE),
  );
}

function migrateCookiesToStorage() {
  const cookieAccess = readCookie(config.cookies.accessToken);
  const cookieRefresh = readCookie(config.cookies.refreshToken);
  if (!cookieAccess && !cookieRefresh) return;

  const storedAccess = readStorage(config.tokens.accessToken);
  const storedRefresh = readStorage(config.tokens.refreshToken);
  if (storedAccess || storedRefresh) return;

  const { access_expires_at, refresh_expires_at } = computeTokenExpiry();
  if (cookieAccess) {
    writeStorage(config.tokens.accessToken, cookieAccess);
    writeStorage(config.tokens.accessExpiresAt, String(access_expires_at));
  }
  if (cookieRefresh) {
    writeStorage(config.tokens.refreshToken, cookieRefresh);
    writeStorage(config.tokens.refreshExpiresAt, String(refresh_expires_at));
  }
}

function ensureStorageHydrated() {
  migrateCookiesToStorage();
}

export const tokenStore = {
  get access() {
    ensureStorageHydrated();
    return readStorage(config.tokens.accessToken);
  },
  get refresh() {
    ensureStorageHydrated();
    return readStorage(config.tokens.refreshToken);
  },
  get accessExpiresAt() {
    ensureStorageHydrated();
    return readExpiry(config.tokens.accessExpiresAt);
  },
  get refreshExpiresAt() {
    ensureStorageHydrated();
    return readExpiry(config.tokens.refreshExpiresAt);
  },
  isAccessValid(now = Date.now()) {
    const expiresAt = this.accessExpiresAt;
    if (expiresAt !== null) return expiresAt > now;
    const access = this.access;
    if (!access) return false;
    const claims = decodeJwt(access);
    return !!claims && claims.exp * 1000 > now;
  },
  isRefreshValid(now = Date.now()) {
    const expiresAt = this.refreshExpiresAt;
    if (expiresAt !== null) return expiresAt > now;
    const refresh = this.refresh;
    if (!refresh) return false;
    const claims = decodeJwt(refresh);
    return !!claims && claims.exp * 1000 > now;
  },
  set(
    accessToken: string,
    refreshToken: string,
    meta?: TokenExpiryMeta,
  ) {
    const { access_expires_at, refresh_expires_at } = computeTokenExpiry(meta);
    writeStorage(config.tokens.accessToken, accessToken);
    writeStorage(config.tokens.refreshToken, refreshToken);
    writeStorage(config.tokens.accessExpiresAt, String(access_expires_at));
    writeStorage(config.tokens.refreshExpiresAt, String(refresh_expires_at));
    syncCookies(accessToken, refreshToken, access_expires_at, refresh_expires_at);
  },
  setFromPair(tokens: TokenPair) {
    this.set(tokens.access_token, tokens.refresh_token, {
      expires_in: tokens.expires_in,
      refresh_expires_in: tokens.refresh_expires_in,
    });
  },
  clear() {
    removeStorage(config.tokens.accessToken);
    removeStorage(config.tokens.refreshToken);
    removeStorage(config.tokens.accessExpiresAt);
    removeStorage(config.tokens.refreshExpiresAt);
    deleteCookie(config.cookies.accessToken);
    deleteCookie(config.cookies.refreshToken);
  },
};

export interface JwtPayload {
  uid: string;
  email: string;
  roles: MerchantRole[];
  merchant_id: string;
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
