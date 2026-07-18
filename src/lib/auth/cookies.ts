import type { NextResponse } from "next/server";
import { config } from "@/lib/config";
import type { TokenPair } from "@/lib/api/types";
import {
  ACCESS_COOKIE_MAX_AGE,
  REFRESH_COOKIE_MAX_AGE,
} from "@/lib/auth/session";

const FEATURES_COOKIE_MAX_AGE = REFRESH_COOKIE_MAX_AGE;

const cookieOptions = (maxAge: number) => ({
  path: "/",
  maxAge,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
});

/** Safe JSON parse for the features cookie payload. */
export function parseFeaturesCookie(
  value: string | undefined,
): string[] | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !Array.isArray(parsed) ||
      !parsed.every((entry) => typeof entry === "string")
    ) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

/** Attach resolved feature grants to a Next.js proxy/middleware response. */
export function applyFeaturesCookie(
  response: NextResponse,
  features: string[],
): void {
  response.cookies.set(
    config.cookies.features,
    JSON.stringify(features),
    cookieOptions(FEATURES_COOKIE_MAX_AGE),
  );
}

/** Clear the features cookie on a Next.js proxy/middleware response. */
export function clearFeaturesCookie(response: NextResponse): void {
  response.cookies.delete(config.cookies.features);
}

/** Mirror features cookie in the browser (same path/max-age/sameSite/secure as tokens). */
export function setBrowserFeaturesCookie(features: string[]): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const encoded = encodeURIComponent(JSON.stringify(features));
  document.cookie = `${config.cookies.features}=${encoded}; Path=/; Max-Age=${FEATURES_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

/** Delete the features cookie in the browser. */
export function clearBrowserFeaturesCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${config.cookies.features}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/** Attach refreshed auth cookies to a Next.js proxy/middleware response. */
export function applyTokenCookies(
  response: NextResponse,
  tokens: TokenPair,
): void {
  response.cookies.set(
    config.cookies.accessToken,
    tokens.access_token,
    cookieOptions(ACCESS_COOKIE_MAX_AGE),
  );
  response.cookies.set(
    config.cookies.refreshToken,
    tokens.refresh_token,
    cookieOptions(REFRESH_COOKIE_MAX_AGE),
  );
}

/** Clear auth cookies on a Next.js proxy/middleware response. */
export function clearTokenCookies(response: NextResponse): void {
  response.cookies.delete(config.cookies.accessToken);
  response.cookies.delete(config.cookies.refreshToken);
  clearFeaturesCookie(response);
}
