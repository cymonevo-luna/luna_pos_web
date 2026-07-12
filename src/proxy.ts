import { NextResponse, type NextRequest } from "next/server";
import { config as appConfig } from "@/lib/config";
import { applyTokenCookies, clearTokenCookies } from "@/lib/auth/cookies";
import { refreshTokenPair } from "@/lib/auth/refresh";
import {
  isClaimsValid,
  needsTokenRefresh,
  resolveSessionClaims,
} from "@/lib/auth/session";
import { decodeJwt } from "@/lib/auth/tokens";
import {
  canAccessRoute,
  getAuthenticatedLandingPath,
  getUnauthorizedFallbackPath,
  hasMerchantAreaAccess,
  resolveUserRoles,
} from "@/lib/auth/roles";

// Public auth pages (never require a session).
const AUTH_ROUTES = ["/login", "/register", "/admin/login", "/admin/register"];

const isAuthRoute = (pathname: string) =>
  AUTH_ROUTES.some((p) => pathname === p);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get(appConfig.cookies.accessToken)?.value;
  const refreshToken = request.cookies.get(appConfig.cookies.refreshToken)?.value;

  let claims = resolveSessionClaims(accessToken, refreshToken);
  let refreshedTokens = null;

  if (needsTokenRefresh(accessToken, refreshToken) && refreshToken) {
    refreshedTokens = await refreshTokenPair(refreshToken);
    if (refreshedTokens) {
      claims = decodeJwt(refreshedTokens.access_token);
    } else {
      claims = null;
    }
  }

  const isAuthed = isClaimsValid(claims);

  const withCookies = (response: NextResponse) => {
    if (refreshedTokens) {
      applyTokenCookies(response, refreshedTokens);
    }
    return response;
  };

  const redirectToLogin = (loginPath: string) => {
    const loginUrl = new URL(loginPath, request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(loginUrl);
    if (!refreshedTokens) clearTokenCookies(response);
    return response;
  };

  // Send authenticated users away from the auth pages.
  if (isAuthed && isAuthRoute(pathname)) {
    const target = getAuthenticatedLandingPath(claims);
    return withCookies(NextResponse.redirect(new URL(target, request.url)));
  }

  if (isAuthRoute(pathname)) {
    return withCookies(NextResponse.next());
  }

  const isAdminArea = pathname.startsWith("/admin");
  const needsAuth = pathname.startsWith("/dashboard") || isAdminArea;

  if (needsAuth && !isAuthed) {
    return redirectToLogin(isAdminArea ? "/admin/login" : "/login");
  }

  if (isAdminArea && !hasMerchantAreaAccess(claims)) {
    return withCookies(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  if (
    isAdminArea &&
    claims &&
    !canAccessRoute(pathname, resolveUserRoles(claims))
  ) {
    const fallback = getUnauthorizedFallbackPath(claims);
    return withCookies(NextResponse.redirect(new URL(fallback, request.url)));
  }

  return withCookies(NextResponse.next());
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/login",
    "/register",
  ],
};
