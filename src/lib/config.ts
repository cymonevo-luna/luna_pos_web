/**
 * Centralised runtime configuration. Reads from environment variables with
 * sensible defaults so the template runs out of the box against the companion
 * Go backend (luna_pos_service docker-compose host port 8087 when using .env.example).
 */
export const config = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Next Template",
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080",
  posAppDownloadUrl: process.env.NEXT_PUBLIC_POS_APP_DOWNLOAD_URL ?? "",
  /** Cookie names mirrored from localStorage for Next.js middleware route guards. */
  cookies: {
    accessToken: "nt_access_token",
    refreshToken: "nt_refresh_token",
  },
  /** localStorage keys for auth tokens and expiry metadata. */
  tokens: {
    accessToken: "nt_access_token",
    refreshToken: "nt_refresh_token",
    accessExpiresAt: "nt_access_expires_at",
    refreshExpiresAt: "nt_refresh_expires_at",
  },
  /** localStorage keys for user and merchant session context. */
  session: {
    user: "nt_user",
    merchant: "nt_merchant",
  },
} as const;

export type AppConfig = typeof config;
