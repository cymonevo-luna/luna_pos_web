import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

export function invalidateTransactionQueries(
  queryClient: QueryClient,
): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.transactions.all,
  });
}
