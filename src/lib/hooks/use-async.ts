"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Re-run the async function imperatively (e.g. after a mutation). */
  reload: () => void;
}

/**
 * useAsync runs an async function on mount and whenever the serialised deps
 * change, tracking loading and error state. It is the template's lightweight
 * alternative to a data-fetching library, consistent with the manual api client.
 *
 * The latest fn is always read from a ref, so callers may pass inline closures
 * without memoising them; re-runs are driven by `deps` instead.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  const reload = () => setNonce((n) => n + 1);

  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fnRef
      .current()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof ApiError ? err.message : "Something went wrong",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [depsKey, nonce]);

  return { data, loading, error, reload };
}
