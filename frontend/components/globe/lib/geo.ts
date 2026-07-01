/**
 * Geo helpers for the globe. Pure functions with no Cesium/three/DOM
 * dependency, so they are trivially testable and SSR-safe.
 */
import type { Country } from "@aurora/backend/types";

const DEG2RAD = Math.PI / 180;

/**
 * Great-circle central angle (radians) between two lat/lng points via the
 * haversine formula. We only ever compare these values, so the Earth radius is
 * intentionally omitted (the angle is a monotonic proxy for real distance).
 */
export function angularDistance(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dLat = (bLat - aLat) * DEG2RAD;
  const dLng = (bLng - aLng) * DEG2RAD;
  const lat1 = aLat * DEG2RAD;
  const lat2 = bLat * DEG2RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * ISO2 of the country whose centroid is nearest the given point, or `undefined`
 * if the list is empty. Used by click-to-select to map a globe hit → a country.
 */
export function nearestCountryIso2(
  lat: number,
  lng: number,
  countries: readonly Country[],
): string | undefined {
  let bestIso: string | undefined;
  let bestDist = Infinity;
  for (const c of countries) {
    const d = angularDistance(lat, lng, c.lat, c.lng);
    if (d < bestDist) {
      bestDist = d;
      bestIso = c.iso2;
    }
  }
  return bestIso;
}
