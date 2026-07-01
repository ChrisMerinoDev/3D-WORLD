"use client";

import { useEffect, useState } from "react";

/**
 * Reactively tracks the user's `prefers-reduced-motion` setting.
 * Returns `false` during SSR / before hydration so the first client paint is
 * safe, then updates once the media query resolves.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}
