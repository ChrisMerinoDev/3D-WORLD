/**
 * Centralized scene constants for the Aurora globe.
 * Radii are in world units; the Earth radius is the reference (1.0).
 */

/** Base radius of the Earth sphere. Everything else is relative to this. */
export const EARTH_RADIUS = 1;

/** Radius of the drifting cloud shell (just above the surface). */
export const CLOUD_RADIUS = EARTH_RADIUS * 1.008;

/** Radius at which lat/lng markers are placed (slightly above the surface). */
export const MARKER_RADIUS = EARTH_RADIUS * 1.012;

/** Radius of the back-side atmosphere glow shell. */
export const ATMOSPHERE_RADIUS = EARTH_RADIUS * 1.22;

/** Orbit-controls distance clamps (keep the camera outside the atmosphere). */
export const CAMERA_MIN_DISTANCE = EARTH_RADIUS * 1.28;
export const CAMERA_MAX_DISTANCE = EARTH_RADIUS * 6;

/** Camera framing distance per drill level. */
export const LEVEL_DISTANCE = {
  world: EARTH_RADIUS * 3.1,
  country: EARTH_RADIUS * 2.0,
  state: EARTH_RADIUS * 1.6,
  city: EARTH_RADIUS * 1.42,
} as const;

/** Marker base sizes per drill layer. */
export const MARKER_SIZE = {
  country: 0.012,
  state: 0.009,
  city: 0.007,
} as const;

/** Idle auto-rotation speed (radians / second) at world level. */
export const IDLE_SPIN_SPEED = 0.03;

/** Gentle camera orbit speed used when a city is focused. */
export const CITY_ORBIT_SPEED = 0.35;

/** Fly-to tween duration (seconds) when motion is allowed. */
export const FLYTO_DURATION = 1.35;

/** Cohesive Aurora palette (space / ocean / land / accents). */
export const PALETTE = {
  space: "#04060d",
  oceanDay: "#0b3557",
  oceanNight: "#050b1c",
  landDay: "#15916a",
  landNight: "#0a1730",
  cityLight: "#ffcf8f",
  atmosphere: "#4ff0e0",
  atmosphereWarm: "#7fb8ff",
  country: "#79f7ff",
  countryActive: "#ffffff",
  state: "#c39bff",
  stateActive: "#ffffff",
  city: "#ffd479",
  cityActive: "#ffffff",
} as const;
