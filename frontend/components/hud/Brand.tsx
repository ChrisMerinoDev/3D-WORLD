"use client";

import { motion, useReducedMotion } from "framer-motion";

/** Aurora wordmark, top-left of the HUD. */
export function Brand() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="pointer-events-none select-none"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full bg-aurora shadow-[0_0_12px_2px_var(--color-aurora)]"
        />
        <h1 className="font-display text-lg font-semibold tracking-[0.42em] text-ink sm:text-xl">
          AURORA
        </h1>
      </div>
      <p className="mt-1 pl-4 font-display text-[0.58rem] uppercase tracking-[0.34em] text-ink/45">
        Real-Time 3D World
      </p>
    </motion.div>
  );
}
