import type { NextResponse } from "next/server";
import { config } from "@/lib/config";
import type { TokenPair } from "@/lib/api/types";
import {
  ACCESS_COOKIE_MAX_AGE,
  REFRESH_COOKIE_MAX_AGE,
} from "@/lib/auth/session";

const cookieOptions = (maxAge: number) => ({
  path: "/",
  maxAge,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
});

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
}
