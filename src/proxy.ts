import { NextResponse, type NextRequest } from "next/server";
import { config as appConfig } from "@/lib/config";
import {
  applyFeaturesCookie,
  applyTokenCookies,
  clearTokenCookies,
  parseFeaturesCookie,
} from "@/lib/auth/cookies";
import type { FeatureSource } from "@/lib/auth/features";
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
  hasMerchantAreaAccess,
} from "@/lib/auth/roles";
import { getUnauthorizedRedirectTarget } from "@/lib/auth/unauthorized-access";

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
  let refreshedFeatures: string[] | undefined;

  if (needsTokenRefresh(accessToken, refreshToken) && refreshToken) {
    const refreshed = await refreshTokenPair(refreshToken);
    if (refreshed) {
      refreshedTokens = refreshed.tokens;
      if (refreshed.features) {
        refreshedFeatures = refreshed.features;
      }
      claims = decodeJwt(refreshed.tokens.access_token);
    } else {
      claims = null;
    }
  }

  const isAuthed = isClaimsValid(claims);

  const featuresFromCookie = parseFeaturesCookie(
    request.cookies.get(appConfig.cookies.features)?.value,
  );
  const effectiveFeatures = refreshedFeatures ?? featuresFromCookie;

  const featureSource: FeatureSource = claims
    ? {
        roles: claims.roles,
        merchant_id: claims.merchant_id,
        ...(effectiveFeatures !== undefined
          ? { features: effectiveFeatures }
          : {}),
      }
    : null;

  const withCookies = (response: NextResponse) => {
    if (refreshedTokens) {
      applyTokenCookies(response, refreshedTokens);
    }
    if (refreshedFeatures) {
      applyFeaturesCookie(response, refreshedFeatures);
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
    const target = getAuthenticatedLandingPath(featureSource);
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

  if (isAdminArea && !hasMerchantAreaAccess(featureSource)) {
    return withCookies(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  if (
    isAdminArea &&
    featureSource &&
    !canAccessRoute(pathname, featureSource)
  ) {
    const fallback = getUnauthorizedRedirectTarget(pathname, featureSource);
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
