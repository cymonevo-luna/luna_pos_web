"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, type ApiResult } from "@/lib/api/client";
import {
  createAdjustment,
  deleteEntry,
  getBalance,
  listEntries,
  type CreateCashierBalanceAdjustmentPayload,
  type ListCashierBalanceEntriesParams,
} from "@/lib/api/cashier-balance";
import type { CashierBalance, CashierBalanceEntry } from "@/lib/api/types";

type InvalidationListener = () => void;
const listeners = new Set<InvalidationListener>();

/** Invalidate all active cashier balance queries (called after mutations). */
export function invalidateCashierBalanceData() {
  listeners.forEach((listener) => listener());
}

function useCashierBalanceInvalidation(): number {
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const listener = () => setNonce((value) => value + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return nonce;
}

export const cashierBalanceQueryKeys = {
  all: ["cashier-balance"] as const,
  balance: () => [...cashierBalanceQueryKeys.all, "balance"] as const,
  entries: () => [...cashierBalanceQueryKeys.all, "entries"] as const,
  entriesList: (params: ListCashierBalanceEntriesParams) =>
    [...cashierBalanceQueryKeys.entries(), params] as const,
};

export function useCashierBalance() {
  const invalidationNonce = useCashierBalanceInvalidation();
  const [data, setData] = useState<ApiResult<CashierBalance> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    invalidateCashierBalanceData();
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getBalance()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Failed to load cashier balance",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [invalidationNonce]);

  return {
    data,
    balance: data?.data ?? null,
    loading,
    error,
    refetch,
  };
}

export function useCashierBalanceEntries(
  params: ListCashierBalanceEntriesParams = {},
) {
  const invalidationNonce = useCashierBalanceInvalidation();
  const [data, setData] = useState<ApiResult<CashierBalanceEntry[]> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const paramsKey = JSON.stringify(params);

  const refetch = useCallback(() => {
    invalidateCashierBalanceData();
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    listEntries(params)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Failed to load cashier balance history",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [paramsKey, invalidationNonce]);

  return {
    data,
    entries: data?.data ?? [],
    meta: data?.meta,
    loading,
    error,
    refetch,
  };
}

function useCashierBalanceMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutateAsync = useCallback(
    async (...args: TArgs) => {
      setIsPending(true);
      setError(null);
      try {
        const result = await mutationFn(...args);
        invalidateCashierBalanceData();
        return result;
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Request failed";
        setError(message);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [mutationFn],
  );

  const mutate = useCallback(
    (...args: TArgs) => {
      void mutateAsync(...args);
    },
    [mutateAsync],
  );

  return { mutate, mutateAsync, isPending, error };
}

export function useCreateCashierBalanceAdjustment() {
  return useCashierBalanceMutation(
    (payload: CreateCashierBalanceAdjustmentPayload) =>
      createAdjustment(payload),
  );
}

export function useDeleteCashierBalanceEntry() {
  return useCashierBalanceMutation((id: string) => deleteEntry(id));
}
