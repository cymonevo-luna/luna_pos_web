"use client";

import { useQuery } from "@tanstack/react-query";
import { transactionsAdminApi } from "@/lib/api/transactions";
import type { ListTransactionsParams } from "@/lib/api/transactions";
import { queryKeys } from "@/lib/query/keys";

export function useTransactionsListQuery(
  params: ListTransactionsParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.transactions.list(params),
    queryFn: () => transactionsAdminApi.list(params),
    enabled: options?.enabled ?? true,
  });
}
