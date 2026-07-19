"use client";

import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/users";
import { queryKeys } from "@/lib/query/keys";

export function useAdminUsersListQuery(
  params: { page?: number; perPage?: number; search?: string },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => adminApi.listUsers(params),
    enabled: options?.enabled ?? true,
  });
}
