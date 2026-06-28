import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Returns false during server render and the first client paint, then true.
 * Useful for avoiding hydration mismatches without a setState-in-effect.
 */
export function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
