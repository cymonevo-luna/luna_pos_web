"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { menuDisposalsAdminApi } from "@/lib/api/menu-disposals";
import { ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";

export function useUpdateMenuDisposalDate() {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutateAsync = useCallback(
    async (id: string, disposedAt: string) => {
      setIsPending(true);
      setError(null);
      try {
        const result = await menuDisposalsAdminApi.updateDisposedDate(
          id,
          disposedAt,
        );
        await queryClient.invalidateQueries({
          queryKey: queryKeys.menuDisposals.all,
        });
        return result;
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to update disposal date";
        setError(message);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [queryClient],
  );

  return { mutateAsync, isPending, error };
}
