"use client";

import { useQuery } from "@tanstack/react-query";
import { menusAdminApi, type ListMenusParams } from "@/lib/api/menus";
import { queryKeys } from "@/lib/query/keys";

export function useMenusListQuery(
  params: ListMenusParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.menus.list(params),
    queryFn: () => menusAdminApi.list(params),
    enabled: options?.enabled ?? true,
  });
}
