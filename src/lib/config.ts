/**
 * Centralised runtime configuration. Reads from environment variables with
 * sensible defaults so the template runs out of the box against the companion
 * Go backend (go_template) on localhost:8080.
 */
export const config = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Next Template",
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080",
  /** Cookie names used to persist the auth session on the client. */
  cookies: {
    accessToken: "nt_access_token",
    refreshToken: "nt_refresh_token",
  },
} as const;

export type AppConfig = typeof config;
