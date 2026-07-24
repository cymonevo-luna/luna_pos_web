"use client";

import { useQuery } from "@tanstack/react-query";
import {
  menuDisposalsAdminApi,
  type ListMenuDisposalsParams,
} from "@/lib/api/menu-disposals";
import { queryKeys } from "@/lib/query/keys";

export function useMenuDisposalsListQuery(
  params: ListMenuDisposalsParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.menuDisposals.list(params),
    queryFn: () => menuDisposalsAdminApi.list(params),
    enabled: options?.enabled ?? true,
  });
}
