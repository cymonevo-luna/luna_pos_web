"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, type ApiResult } from "@/lib/api/client";
import {
  createAdjustment,
  deleteEntry,
  getBalance,
  listEntries,
  updateEntryRecordDate,
  type CreateQrisBalanceAdjustmentPayload,
  type ListQrisBalanceEntriesParams,
} from "@/lib/api/qris-balance";
import type { QrisBalance, QrisBalanceEntry } from "@/lib/api/types";

type InvalidationListener = () => void;
const listeners = new Set<InvalidationListener>();

/** Invalidate all active QRIS balance queries (called after mutations). */
export function invalidateQrisBalanceData() {
  listeners.forEach((listener) => listener());
}

function useQrisBalanceInvalidation(): number {
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

export const qrisBalanceQueryKeys = {
  all: ["qris-balance"] as const,
  balance: () => [...qrisBalanceQueryKeys.all, "balance"] as const,
  entries: () => [...qrisBalanceQueryKeys.all, "entries"] as const,
  entriesList: (params: ListQrisBalanceEntriesParams) =>
    [...qrisBalanceQueryKeys.entries(), params] as const,
};

export function useQrisBalance() {
  const invalidationNonce = useQrisBalanceInvalidation();
  const [data, setData] = useState<ApiResult<QrisBalance> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    invalidateQrisBalanceData();
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
              : "Failed to load QRIS balance",
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

export function useQrisBalanceEntries(
  params: ListQrisBalanceEntriesParams = {},
) {
  const invalidationNonce = useQrisBalanceInvalidation();
  const [data, setData] = useState<ApiResult<QrisBalanceEntry[]> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const paramsKey = JSON.stringify(params);

  const refetch = useCallback(() => {
    invalidateQrisBalanceData();
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
              : "Failed to load QRIS balance history",
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

function useQrisBalanceMutation<TArgs extends unknown[], TResult>(
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
        invalidateQrisBalanceData();
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

export function useCreateQrisBalanceAdjustment() {
  return useQrisBalanceMutation(
    (payload: CreateQrisBalanceAdjustmentPayload) =>
      createAdjustment(payload),
  );
}

export function useDeleteQrisBalanceEntry() {
  return useQrisBalanceMutation((id: string) => deleteEntry(id));
}

export function useUpdateQrisBalanceEntryRecordDate() {
  return useQrisBalanceMutation((entryId: string, recordDate: Date) =>
    updateEntryRecordDate(entryId, recordDate),
  );
}
