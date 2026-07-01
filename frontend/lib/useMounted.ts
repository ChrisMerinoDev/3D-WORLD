"use client";

import { useEffect, useState } from "react";

/**
 * Returns `false` during SSR and the first client render, then `true` after
 * mount. Used to gate time-dependent UI so the server-rendered HTML matches the
 * initial client render (no hydration mismatch) while reserving layout space.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
