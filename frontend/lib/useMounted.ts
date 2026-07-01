"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Returns `false` during SSR and the first client render, then `true` after
 * mount. Used to gate time-dependent UI so the server-rendered HTML matches the
 * initial client render (no hydration mismatch) while reserving layout space.
 *
 * Implemented with `useSyncExternalStore` (server snapshot `false`, client
 * snapshot `true`) to avoid a setState-in-effect cascading render.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
