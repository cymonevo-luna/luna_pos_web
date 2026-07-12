/**
 * Centralised runtime configuration. Reads from environment variables with
 * sensible defaults so the template runs out of the box against the companion
 * Go backend (go_template) on localhost:8080.
 */

const DEFAULT_API_BASE_URL = "http://localhost:8080";

/** Strip trailing slashes so `${apiBaseUrl}${path}` never double-slashes. */
export function normalizeApiBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function resolveApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return DEFAULT_API_BASE_URL;
  return normalizeApiBaseUrl(raw);
}

export const config = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Next Template",
  apiBaseUrl: resolveApiBaseUrl(),
  /** Cookie names used to persist the auth session on the client. */
  cookies: {
    accessToken: "nt_access_token",
    refreshToken: "nt_refresh_token",
  },
  /**
   * Cross-origin API calls must not send cookies (backend CORS defaults to
   * AllowCredentials: false). Auth uses Bearer tokens in headers instead.
   */
  apiFetchInit: {
    credentials: "omit",
  } satisfies Pick<RequestInit, "credentials">,
} as const;

export type AppConfig = typeof config;
