"use client";

import { Brand } from "./Brand";
import { WorldClock } from "./WorldClock";
import { DatePanel } from "./DatePanel";
import { Breadcrumb } from "./Breadcrumb";
import { NavigatorPanel } from "./NavigatorPanel";

/**
 * The overlay HUD. The root layer is `pointer-events-none` so the globe stays
 * fully interactive; each interactive surface re-enables pointer events for
 * itself. Everything is absolutely positioned over the full-viewport globe.
 */
export function Hud() {
  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      {/* Cinematic edge vignette — purely decorative. */}
      <div aria-hidden className="hud-vignette absolute inset-0" />

      {/* Top row: brand (left) + clock/date stack (right). */}
      <header className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-6">
        <Brand />
        <div className="flex flex-col items-end gap-2.5 sm:gap-3">
          <WorldClock />
          <DatePanel />
        </div>
      </header>

      {/* Breadcrumb sits under the brand, clear of the clock stack. */}
      <div className="absolute left-3 top-[4.75rem] sm:left-6 sm:top-28">
        <Breadcrumb />
      </div>

      {/* Level navigator: bottom sheet on mobile, left rail on desktop. */}
      <NavigatorPanel />
    </div>
  );
}
