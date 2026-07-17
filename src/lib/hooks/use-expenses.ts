"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, type ApiResult } from "@/lib/api/client";
import {
  createExpense,
  deleteExpense,
  getExpense,
  listExpenses,
  updateExpense,
  uploadExpenseReceipt,
  type CreateExpensePayload,
  type ListExpensesParams,
  type UpdateExpensePayload,
} from "@/lib/api/expenses";
import type { Expense } from "@/lib/api/types";
import type { ExpenseReceiptUploadResult } from "@/lib/api/uploads";

type InvalidationListener = () => void;
const listListeners = new Set<InvalidationListener>();

/** Invalidate all active expense list queries (called after mutations). */
export function invalidateExpenseLists() {
  listListeners.forEach((listener) => listener());
}

function useExpenseListInvalidation(): number {
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const listener = () => setNonce((value) => value + 1);
    listListeners.add(listener);
    return () => {
      listListeners.delete(listener);
    };
  }, []);

  return nonce;
}

export const expenseQueryKeys = {
  all: ["expenses"] as const,
  lists: () => [...expenseQueryKeys.all, "list"] as const,
  list: (params: ListExpensesParams) =>
    [...expenseQueryKeys.lists(), params] as const,
  details: () => [...expenseQueryKeys.all, "detail"] as const,
  detail: (id: string) => [...expenseQueryKeys.details(), id] as const,
};

export function useExpenses(params: ListExpensesParams = {}) {
  const invalidationNonce = useExpenseListInvalidation();
  const [data, setData] = useState<ApiResult<Expense[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const paramsKey = JSON.stringify(params);

  const refetch = useCallback(() => {
    invalidateExpenseLists();
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    listExpenses(params)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof ApiError ? err.message : "Failed to load expenses",
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
    expenses: data?.data ?? [],
    meta: data?.meta,
    loading,
    error,
    refetch,
  };
}

export function useExpense(id: string | null | undefined) {
  const [data, setData] = useState<ApiResult<Expense> | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getExpense(id)
      .then((result) => setData(result))
      .catch((err) => {
        setError(
          err instanceof ApiError ? err.message : "Failed to load expense",
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    getExpense(id)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof ApiError ? err.message : "Failed to load expense",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  return {
    data,
    expense: data?.data ?? null,
    loading,
    error,
    refetch,
  };
}

function useExpenseMutation<TArgs extends unknown[], TResult>(
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
        invalidateExpenseLists();
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

export function useCreateExpense() {
  return useExpenseMutation((payload: CreateExpensePayload) =>
    createExpense(payload),
  );
}

export function useUpdateExpense() {
  return useExpenseMutation((id: string, payload: UpdateExpensePayload) =>
    updateExpense(id, payload),
  );
}

export function useDeleteExpense() {
  return useExpenseMutation((id: string) => deleteExpense(id));
}

export function useUploadExpenseReceipt() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutateAsync = useCallback(async (file: File) => {
    setIsPending(true);
    setError(null);
    try {
      return await uploadExpenseReceipt(file);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Upload failed";
      setError(message);
      throw err;
    } finally {
      setIsPending(false);
    }
  }, []);

  const mutate = useCallback(
    (file: File) => {
      void mutateAsync(file);
    },
    [mutateAsync],
  );

  return {
    mutate,
    mutateAsync,
    isPending,
    error,
  } satisfies {
    mutate: (file: File) => void;
    mutateAsync: (file: File) => Promise<ExpenseReceiptUploadResult>;
    isPending: boolean;
    error: string | null;
  };
}
