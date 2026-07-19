"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { transactionsAdminApi } from "@/lib/api/transactions";
import { ApiError } from "@/lib/api/client";
import { invalidateCashierBalanceData } from "@/lib/hooks/use-cashier-balance";
import { invalidateTransactionQueries } from "@/lib/query/invalidate-transaction-queries";

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutateAsync = useCallback(
    async (id: string) => {
      setIsPending(true);
      setError(null);
      try {
        const result = await transactionsAdminApi.delete(id);
        await invalidateTransactionQueries(queryClient);
        invalidateCashierBalanceData();
        return result;
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to delete transaction";
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
