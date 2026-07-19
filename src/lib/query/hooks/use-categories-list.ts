"use client";

import { useQuery } from "@tanstack/react-query";
import {
  categoriesAdminApi,
  type ListCategoriesParams,
} from "@/lib/api/categories";
import { queryKeys } from "@/lib/query/keys";

export function useCategoriesListQuery(
  params: ListCategoriesParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.categories.list(params),
    queryFn: () => categoriesAdminApi.list(params),
    enabled: options?.enabled ?? true,
  });
}
