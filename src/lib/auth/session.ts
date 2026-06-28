import { decodeJwt, type JwtPayload } from "@/lib/auth/tokens";

/** Cookie lifetime for both tokens — matches backend refresh TTL (7 days). */
export const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
export const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export function isClaimsValid(claims: JwtPayload | null | undefined): boolean {
  return !!claims && claims.exp * 1000 > Date.now();
}

/**
 * Returns claims from a valid access token, or — when access is missing/expired
 * — from a still-valid refresh token (for routing until refresh completes).
 */
export function resolveSessionClaims(
  accessToken: string | null | undefined,
  refreshToken: string | null | undefined,
): JwtPayload | null {
  const accessClaims = accessToken ? decodeJwt(accessToken) : null;
  if (isClaimsValid(accessClaims)) return accessClaims;

  const refreshClaims = refreshToken ? decodeJwt(refreshToken) : null;
  if (isClaimsValid(refreshClaims)) return refreshClaims;

  return null;
}

/** True when access is unusable but a refresh token can still extend the session. */
export function needsTokenRefresh(
  accessToken: string | null | undefined,
  refreshToken: string | null | undefined,
): boolean {
  const accessClaims = accessToken ? decodeJwt(accessToken) : null;
  if (isClaimsValid(accessClaims)) return false;

  const refreshClaims = refreshToken ? decodeJwt(refreshToken) : null;
  return isClaimsValid(refreshClaims);
}
