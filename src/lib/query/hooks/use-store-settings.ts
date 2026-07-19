"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminStoreSettings } from "@/lib/api/store-settings";
import { queryKeys } from "@/lib/query/keys";

export function useStoreSettingsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.storeSettings.detail(),
    queryFn: () => getAdminStoreSettings(),
    enabled: options?.enabled ?? true,
  });
}
