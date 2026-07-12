import { config } from "@/lib/config";
import type { Envelope, TokenPair } from "@/lib/api/types";

let refreshInFlight: Promise<TokenPair | null> | null = null;

async function requestRefresh(refreshToken: string): Promise<TokenPair | null> {
  try {
    const res = await fetch(`${config.apiBaseUrl}/api/v1/auth/refresh`, {
      ...config.apiFetchInit,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<{ tokens: TokenPair }>;
    return json.data?.tokens ?? null;
  } catch {
    return null;
  }
}

/** Exchange a refresh token for a new pair. Concurrent calls are deduped. */
export async function refreshTokenPair(
  refreshToken: string,
): Promise<TokenPair | null> {
  refreshInFlight ??= requestRefresh(refreshToken).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** @internal Resets in-flight dedupe between tests. */
export function resetRefreshInFlightForTests() {
  refreshInFlight = null;
}
