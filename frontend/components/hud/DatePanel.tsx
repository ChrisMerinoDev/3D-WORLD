"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useWorldStore } from "@/store/worldStore";
import { useZonedTime } from "@/lib/useClock";
import { useMounted } from "@/lib/useMounted";

/**
 * Calendar date for the same `activeTimezone` as the clock, driven by the same
 * shared ticker so it rolls over exactly at local midnight.
 */
export function DatePanel() {
  const zone = useWorldStore((s) => s.activeTimezone);
  const t = useZonedTime(zone);
  const mounted = useMounted();
  const reduce = useReducedMotion();

  return (
    <motion.section
      data-testid="date-panel"
      aria-label="Local date"
      initial={reduce ? false : { opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.12 }}
      className="glass pointer-events-auto w-[13.5rem] rounded-2xl px-4 py-3 sm:w-60 sm:px-5"
    >
      <div className="font-display text-[0.58rem] uppercase tracking-[0.3em] text-city/80">
        {mounted ? t.weekday : "—"}
      </div>
      <div className="mt-1 font-display text-lg font-medium tracking-wide text-ink sm:text-xl">
        {mounted ? (
          <>
            {t.monthName}{" "}
            <span className="tabular-nums">{t.day}</span>
            <span className="text-ink/40">, </span>
            <span className="tabular-nums text-ink/80">{t.year}</span>
          </>
        ) : (
          <span className="text-ink/40">— — —</span>
        )}
      </div>
    </motion.section>
  );
}
