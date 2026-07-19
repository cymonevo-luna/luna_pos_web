"use client";

import { useQuery } from "@tanstack/react-query";
import { transactionsAdminApi } from "@/lib/api/transactions";
import type { SummaryTransactionsParams } from "@/lib/api/transactions";
import { queryKeys } from "@/lib/query/keys";

export function useTransactionSummaryQuery(
  params: SummaryTransactionsParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.transactions.summary(params),
    queryFn: () => transactionsAdminApi.summary(params),
    enabled: options?.enabled ?? true,
  });
}
