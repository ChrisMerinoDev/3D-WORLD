import type { DrillLevel } from "@/store/worldStore";

/** Accent color per drill level — mirrors the globe marker palette. */
export const LEVEL_ACCENT: Record<DrillLevel, string> = {
  world: "var(--color-aurora)",
  country: "var(--color-country)",
  state: "var(--color-state)",
  city: "var(--color-city)",
};

export const LEVEL_LABEL: Record<DrillLevel, string> = {
  world: "World",
  country: "Country",
  state: "Region",
  city: "City",
};
