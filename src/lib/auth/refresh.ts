import { config } from "@/lib/config";
import type { Envelope, RefreshResult } from "@/lib/api/types";

let refreshInFlight: Promise<RefreshResult | null> | null = null;

async function requestRefresh(refreshToken: string): Promise<RefreshResult | null> {
  try {
    const res = await fetch(`${config.apiBaseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<RefreshResult>;
    if (!json.data?.tokens) return null;
    return json.data;
  } catch {
    return null;
  }
}

/** Exchange a refresh token for a new pair and current feature grants. */
export async function refreshTokenPair(
  refreshToken: string,
): Promise<RefreshResult | null> {
  refreshInFlight ??= requestRefresh(refreshToken).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** @internal Resets in-flight dedupe between tests. */
export function resetRefreshInFlightForTests() {
  refreshInFlight = null;
}
