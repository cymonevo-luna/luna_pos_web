"use client";

import { useQuery } from "@tanstack/react-query";
import { suppliersAdminApi } from "@/lib/api/suppliers";
import { purchaseRequestsAdminApi } from "@/lib/api/purchase-requests";
import { queryKeys } from "@/lib/query/keys";

export function useSuppliersListQuery(
  params: { page?: number; perPage?: number },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.suppliers.list(params),
    queryFn: () => suppliersAdminApi.list(params),
    enabled: options?.enabled ?? true,
  });
}

export function usePurchaseRequestsListQuery(
  params: { page?: number; perPage?: number },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.purchaseRequests.list(params),
    queryFn: () => purchaseRequestsAdminApi.list(params),
    enabled: options?.enabled ?? true,
  });
}
