"use client";

import { useQuery } from "@tanstack/react-query";
import {
  menuDisposalsAdminApi,
  type MenuDisposalSummaryParams,
} from "@/lib/api/menu-disposals";
import { queryKeys } from "@/lib/query/keys";

export function useMenuDisposalSummaryQuery(
  params: MenuDisposalSummaryParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.menuDisposals.summary(params),
    queryFn: () => menuDisposalsAdminApi.summary(params),
    enabled: options?.enabled ?? true,
  });
}
