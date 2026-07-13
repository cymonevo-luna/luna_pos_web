import type { TokenPair } from "@/lib/api/types";
import { decodeJwt, tokenStore } from "@/lib/auth/tokens";

/** Refresh access tokens when they expire within this window (seconds). */
export const ACCESS_REFRESH_BUFFER_SECONDS = 120;

/** Minimum interval between activity-driven refresh calls (milliseconds). */
export const ACTIVITY_REFRESH_DEBOUNCE_MS = 5 * 60 * 1000;

export interface StoredTokens {
  accessToken: string | null;
  refreshToken: string | null;
  accessExpiresAt: number | null;
  refreshExpiresAt: number | null;
}

export function getTokens(): StoredTokens {
  return {
    accessToken: tokenStore.access,
    refreshToken: tokenStore.refresh,
    accessExpiresAt: tokenStore.accessExpiresAt,
    refreshExpiresAt: tokenStore.refreshExpiresAt,
  };
}

export function setTokens(pair: TokenPair): void {
  tokenStore.setFromPair(pair);
}

export function isRefreshValid(now = Date.now()): boolean {
  return tokenStore.isRefreshValid(now);
}

/**
 * True when the access token is missing, already expired, or will expire
 * within `bufferSeconds` (default 2 minutes).
 */
export function isAccessExpiringSoon(
  bufferSeconds = ACCESS_REFRESH_BUFFER_SECONDS,
  now = Date.now(),
): boolean {
  const expiresAt = tokenStore.accessExpiresAt;
  if (expiresAt !== null) {
    return expiresAt - now <= bufferSeconds * 1000;
  }

  const access = tokenStore.access;
  if (!access) return true;

  const claims = decodeJwt(access);
  if (!claims) return true;

  return claims.exp * 1000 - now <= bufferSeconds * 1000;
}
