/**
 * Shared constants for the Aurora Cesium globe.
 *
 * Camera altitudes are expressed in METERS above the ellipsoid (Cesium's unit).
 * Each drill level frames its target at a scale that keeps the relevant detail
 * legible in the satellite imagery — from the whole planet down to real streets.
 */

/** Camera altitude (meters above ground) per drill level. */
export const ALTITUDE = {
  /** Whole-globe overview. */
  world: 20_000_000,
  /** Country scale (~1,500 km up): the nation fills the frame. */
  country: 1_500_000,
  /** Region scale (~250 km up): state/province in context. */
  state: 250_000,
  /** Street scale (~3 km up): real roads, blocks, and buildings visible. */
  city: 3_000,
} as const;

/** Fly-to tween duration in SECONDS (Cesium unit) when motion is allowed. */
export const FLYTO_DURATION = 1.8;

/**
 * How far (meters) sun/time changes may drift before Cesium forces a re-render
 * while `requestRenderMode` is on. `Infinity` = never re-render for the clock,
 * so the GPU fully idles when the camera is still (big battery/perf win).
 */
export const MAX_RENDER_TIME_CHANGE = Infinity;

/** Cap the number of point markers we drop so dense datasets stay smooth. */
export const MAX_MARKERS = 400;

/** Cohesive Aurora accent palette (matches the HUD / shell). */
export const PALETTE = {
  country: "#79f7ff",
  state: "#c39bff",
  city: "#ffd479",
  pick: "#ffffff",
} as const;
