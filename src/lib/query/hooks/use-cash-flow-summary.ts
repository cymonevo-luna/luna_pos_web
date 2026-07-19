"use client";

import { useQuery } from "@tanstack/react-query";
import {
  cashFlowAdminApi,
  type CashFlowSummaryParams,
} from "@/lib/api/cash-flow";
import { queryKeys } from "@/lib/query/keys";

export function useCashFlowSummaryQuery(
  params: CashFlowSummaryParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.cashFlow.summary(params),
    queryFn: () => cashFlowAdminApi.summary(params),
    enabled: options?.enabled ?? true,
  });
}
