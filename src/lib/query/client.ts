import { QueryClient } from "@tanstack/react-query";

/** Default stale window for dashboard navigation (see POS-121-4). */
export const DEFAULT_STALE_TIME_MS = 30_000;

/** Keep cached queries around after unmount so back-navigation reuses them. */
export const DEFAULT_GC_TIME_MS = 5 * 60_000;

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        gcTime: DEFAULT_GC_TIME_MS,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}
