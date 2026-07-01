"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useWorldStore } from "@/store/worldStore";
import { useZonedTime } from "@/lib/useClock";
import { useMounted } from "@/lib/useMounted";

/**
 * Live-ticking clock for the store's `activeTimezone`. Reads the shared ticker
 * (one interval app-wide) and re-renders each second. When the selection
 * changes the zone, the readout switches immediately.
 */
export function WorldClock() {
  const zone = useWorldStore((s) => s.activeTimezone);
  const t = useZonedTime(zone);
  const mounted = useMounted();
  const reduce = useReducedMotion();

  // Split "HH:mm:ss" so the seconds read in the accent color.
  const [hoursMinutes, seconds] = mounted
    ? [t.time.slice(0, 5), t.time.slice(6)]
    : ["--:--", "--"];

  return (
    <motion.section
      data-testid="world-clock"
      aria-label="Local time"
      initial={reduce ? false : { opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.05 }}
      className="glass pointer-events-auto w-[10.75rem] rounded-2xl px-3 py-2.5 sm:w-60 sm:px-5 sm:py-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-[0.58rem] uppercase tracking-[0.3em] text-ink/50">
          Local Time
        </span>
        <span
          className="font-mono text-[0.62rem] font-medium tracking-widest text-aurora"
          aria-label="Timezone abbreviation"
        >
          {mounted ? t.abbreviation : ""}
        </span>
      </div>

      <div
        className="mt-1 font-mono text-2xl font-medium leading-none tabular-nums text-ink sm:text-4xl"
        aria-live="off"
      >
        <span>{hoursMinutes}</span>
        <span className="text-aurora">:{seconds}</span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 font-mono text-[0.62rem] text-ink/45">
        <span className="truncate" title={zone}>
          {t.zoneLabel}
        </span>
        <span className="shrink-0 text-ink/60">{mounted ? t.offsetLabel : ""}</span>
      </div>
    </motion.section>
  );
}
