/**
 * Single source of truth for geographic math on the globe.
 *
 * Convention: latitude in [-90, 90] maps to the polar angle from +Y,
 * longitude in [-180, 180] maps to the azimuth. The same convention is used
 * for markers AND for the sun direction, so the lit hemisphere always lines
 * up with the geography beneath it.
 */
import { Vector3 } from "three";

const DEG2RAD = Math.PI / 180;

/**
 * Convert a lat/lng pair to a point on a sphere of the given radius.
 * Pass a `target` vector to avoid allocations in hot paths (e.g. useFrame).
 */
export function latLngToVector3(
  lat: number,
  lng: number,
  radius: number,
  target: Vector3 = new Vector3(),
): Vector3 {
  const phi = (90 - lat) * DEG2RAD;
  const theta = (lng + 180) * DEG2RAD;
  const sinPhi = Math.sin(phi);
  return target.set(
    -radius * sinPhi * Math.cos(theta),
    radius * Math.cos(phi),
    radius * sinPhi * Math.sin(theta),
  );
}

/**
 * Solar declination (degrees) for a given date — the sub-solar latitude.
 * Simple, textbook approximation (ignores the equation of time).
 */
function solarDeclination(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = (date.getTime() - start) / 86_400_000;
  return -23.44 * Math.cos((360 / 365) * (dayOfYear + 10) * DEG2RAD);
}

/**
 * Sub-solar longitude (degrees, east-positive). At 12:00 UTC the sun is
 * over the prime meridian; each hour shifts it 15° west.
 */
function subSolarLongitude(date: Date): number {
  const utcHours =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600;
  return -15 * (utcHours - 12);
}

/**
 * Unit vector pointing from Earth's center toward the sun for the given
 * moment, expressed in the same frame as {@link latLngToVector3}. Drives the
 * live day/night terminator so the globe feels real-time.
 */
export function sunDirection(date: Date, target: Vector3 = new Vector3()): Vector3 {
  return latLngToVector3(
    solarDeclination(date),
    subSolarLongitude(date),
    1,
    target,
  ).normalize();
}
