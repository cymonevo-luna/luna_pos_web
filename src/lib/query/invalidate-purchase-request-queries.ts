import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

/**
 * Invalidates purchase-request React Query caches (list queries used on the
 * admin overview dashboard and any future RQ-backed list pages).
 *
 * Any future list page migrated to React Query must invalidate its query keys
 * in detail delete handlers before redirect — see also `invalidateMenus` in
 * `menus/page.tsx` and `invalidateTransactionQueries` in
 * `invalidate-transaction-queries.ts`.
 */
export async function invalidatePurchaseRequestQueries(
  queryClient: QueryClient,
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.purchaseRequests.lists(),
  });
}
