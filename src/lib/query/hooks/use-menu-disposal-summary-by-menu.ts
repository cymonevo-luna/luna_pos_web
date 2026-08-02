"use client";

import { useQuery } from "@tanstack/react-query";
import {
  menuDisposalsAdminApi,
  type MenuDisposalSummaryByMenuParams,
} from "@/lib/api/menu-disposals";
import { queryKeys } from "@/lib/query/keys";

export function useMenuDisposalSummaryByMenuQuery(
  params: MenuDisposalSummaryByMenuParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.menuDisposals.summaryByMenu(params),
    queryFn: () => menuDisposalsAdminApi.summaryByMenu(params),
    enabled: options?.enabled ?? true,
  });
}
