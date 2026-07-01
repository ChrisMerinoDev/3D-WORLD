"use client";

import { Fragment } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useWorldStore, type DrillLevel } from "@/store/worldStore";
import { LEVEL_ACCENT } from "./levelAccent";

const ORDER: DrillLevel[] = ["world", "country", "state", "city"];

interface Crumb {
  level: DrillLevel;
  label: string;
  flag?: string;
}

/**
 * Drill path (World › Country › Region › City) plus a Back control. Segments
 * are clickable to jump up the hierarchy; the Back button steps up one level.
 */
export function Breadcrumb() {
  const level = useWorldStore((s) => s.level);
  const country = useWorldStore((s) => s.selectedCountry);
  const state = useWorldStore((s) => s.selectedState);
  const city = useWorldStore((s) => s.selectedCity);
  const goBack = useWorldStore((s) => s.goBack);
  const reset = useWorldStore((s) => s.reset);
  const reduce = useReducedMotion();

  const crumbs: Crumb[] = [{ level: "world", label: "World" }];
  if (country) crumbs.push({ level: "country", label: country.name, flag: country.flag });
  if (state) crumbs.push({ level: "state", label: state.name });
  if (city) crumbs.push({ level: "city", label: city.name });

  const goToLevel = (target: DrillLevel) => {
    if (target === "world") {
      reset();
      return;
    }
    const targetIndex = ORDER.indexOf(target);
    // goBack reads fresh state each call, so stepping in a loop is safe.
    while (ORDER.indexOf(useWorldStore.getState().level) > targetIndex) {
      goBack();
    }
  };

  return (
    <motion.nav
      data-testid="breadcrumb"
      aria-label="Location breadcrumb"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
      className="glass pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3"
    >
      <button
        type="button"
        onClick={goBack}
        disabled={level === "world"}
        aria-label="Go back one level"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-ink transition-colors enabled:hover:bg-aurora/15 enabled:hover:text-aurora disabled:cursor-not-allowed disabled:opacity-30"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden>
          <path
            d="M15 6l-6 6 6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <ol className="aurora-scroll flex items-center gap-1 overflow-x-auto whitespace-nowrap">
        {crumbs.map((crumb, i) => {
          const isCurrent = i === crumbs.length - 1;
          return (
            <Fragment key={crumb.level}>
              {i > 0 && (
                <li aria-hidden className="px-0.5 text-ink/25">
                  ›
                </li>
              )}
              <li>
                <button
                  type="button"
                  onClick={() => goToLevel(crumb.level)}
                  disabled={isCurrent}
                  aria-current={isCurrent ? "page" : undefined}
                  className="flex items-center gap-1.5 rounded-full px-2 py-1 font-display text-[0.72rem] tracking-wide transition-colors enabled:text-ink/55 enabled:hover:text-ink disabled:cursor-default"
                  style={isCurrent ? { color: LEVEL_ACCENT[crumb.level] } : undefined}
                >
                  {crumb.flag && <span aria-hidden>{crumb.flag}</span>}
                  <span className="max-w-[9rem] truncate">{crumb.label}</span>
                </button>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </motion.nav>
  );
}
