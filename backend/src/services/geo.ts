/**
 * Geospatial data service: countries → states → cities.
 *
 * Framework-agnostic and synchronous. All source data is bundled in-memory via
 * `country-state-city`, so lookups are pure CPU with no I/O.
 *
 * Performance model:
 *  - Countries are built once at module load into an array + `Map<iso2>` index
 *    (O(1) lookup, O(n) one-time build).
 *  - States and cities are derived lazily per country/state and memoized, so a
 *    warm serverless invocation never recomputes a subtree it has already served
 *    and cold start stays cheap (we do not eagerly walk ~150k cities).
 */
import { Country as CscCountry, State as CscState, City as CscCity } from "country-state-city";
import type { ICountry, IState, ICity } from "country-state-city";
import type { Country, State, City } from "../types.js";
import { COUNTRY_META } from "../data/countryMeta.js";

/** Normalize an ISO code from untrusted input: trim + upper-case. */
export function normalizeIsoCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Parse a stringified coordinate, returning null when absent/invalid. */
function parseCoord(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Choose the timezone that best represents a country's "default" clock.
 *
 * Countries can span many zones (the US has 29). Rather than blindly taking the
 * first (which for the US is Hawaii–Aleutian), pick the zone whose UTC offset is
 * closest to the one implied by the country's centroid longitude
 * (offsetHours ≈ lng / 15). Ties resolve to the earliest listed zone.
 */
function pickPrimaryTimezone(
  zones: readonly { zoneName: string; gmtOffset: number }[],
  lng: number | null,
): string {
  if (zones.length === 0) return "UTC";
  if (zones.length === 1 || lng == null) return zones[0]!.zoneName;

  const targetHours = lng / 15;
  let best = zones[0]!;
  let bestDelta = Math.abs(best.gmtOffset / 3600 - targetHours);
  for (let i = 1; i < zones.length; i++) {
    const zone = zones[i]!;
    const delta = Math.abs(zone.gmtOffset / 3600 - targetHours);
    if (delta < bestDelta) {
      best = zone;
      bestDelta = delta;
    }
  }
  return best.zoneName;
}

function buildCountry(raw: ICountry): Country {
  const iso2 = raw.isoCode.toUpperCase();
  const meta = COUNTRY_META[iso2];
  const lat = parseCoord(raw.latitude);
  const lng = parseCoord(raw.longitude);

  const rawZones = raw.timezones ?? [];
  // De-duplicate zone names while preserving order.
  const seen = new Set<string>();
  const timezones: string[] = [];
  for (const z of rawZones) {
    if (!seen.has(z.zoneName)) {
      seen.add(z.zoneName);
      timezones.push(z.zoneName);
    }
  }

  const capital = meta?.capital ? meta.capital : undefined;
  const currency = raw.currency && raw.currency.trim() !== "" ? raw.currency : undefined;

  return {
    iso2,
    iso3: meta?.iso3 ?? "",
    name: raw.name,
    flag: raw.flag,
    lat: lat ?? 0,
    lng: lng ?? 0,
    timezones,
    primaryTimezone: pickPrimaryTimezone(rawZones, lng),
    ...(capital !== undefined ? { capital } : {}),
    ...(currency !== undefined ? { currency } : {}),
    stateCount: CscState.getStatesOfCountry(iso2).length,
  };
}

// --- Cold-start indexes (module singletons, reused across warm invocations) ---

const countries: readonly Country[] = CscCountry.getAllCountries()
  .map(buildCountry)
  .sort((a, b) => a.name.localeCompare(b.name));

const countryByIso2: ReadonlyMap<string, Country> = new Map(
  countries.map((c) => [c.iso2, c]),
);

// Lazily-populated memo caches for derived subtrees.
const statesByCountry = new Map<string, State[]>();
const citiesByStateKey = new Map<string, City[]>();

function buildState(raw: IState, countryIso2: string): State {
  const iso = raw.isoCode.toUpperCase();
  return {
    iso,
    name: raw.name,
    countryIso2,
    lat: parseCoord(raw.latitude),
    lng: parseCoord(raw.longitude),
    cityCount: CscCity.getCitiesOfState(countryIso2, iso).length,
  };
}

function buildCities(rawList: ICity[], countryIso2: string, stateIso: string, timezone?: string): City[] {
  const out: City[] = [];
  for (const raw of rawList) {
    const lat = parseCoord(raw.latitude);
    const lng = parseCoord(raw.longitude);
    // The globe needs real coordinates to place a marker; drop coordless rows.
    if (lat == null || lng == null) continue;
    out.push({
      name: raw.name,
      stateIso,
      countryIso2,
      lat,
      lng,
      ...(timezone !== undefined ? { timezone } : {}),
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** All countries, sorted by English name. O(1) after cold start. */
export function getCountries(): Country[] {
  return countries.slice();
}

/** A single country by ISO alpha-2 (case-insensitive), or null if unknown. */
export function getCountry(countryIso2: string): Country | null {
  return countryByIso2.get(normalizeIsoCode(countryIso2)) ?? null;
}

/**
 * First-level subdivisions for a country. Returns null when the country code is
 * unknown (so the transport layer can 404). Result is memoized per country.
 */
export function getStates(countryIso2: string): State[] | null {
  const iso2 = normalizeIsoCode(countryIso2);
  if (!countryByIso2.has(iso2)) return null;

  const cached = statesByCountry.get(iso2);
  if (cached) return cached.slice();

  const states = CscState.getStatesOfCountry(iso2)
    .map((s) => buildState(s, iso2))
    .sort((a, b) => a.name.localeCompare(b.name));
  statesByCountry.set(iso2, states);
  return states.slice();
}

/**
 * Cities within a subdivision. Returns null when the country OR the state code
 * is unknown. City timezone is populated only when unambiguous (the country has
 * a single timezone); otherwise it is omitted. Result is memoized per state.
 */
export function getCities(countryIso2: string, stateIso: string): City[] | null {
  const iso2 = normalizeIsoCode(countryIso2);
  const stIso = normalizeIsoCode(stateIso);
  const country = countryByIso2.get(iso2);
  if (!country) return null;

  // Validate the state belongs to the country (else 404, not empty list).
  const states = getStates(iso2);
  if (!states || !states.some((s) => s.iso === stIso)) return null;

  const key = `${iso2}:${stIso}`;
  const cached = citiesByStateKey.get(key);
  if (cached) return cached.slice();

  const timezone = country.timezones.length === 1 ? country.timezones[0] : undefined;
  const cities = buildCities(CscCity.getCitiesOfState(iso2, stIso), iso2, stIso, timezone);
  citiesByStateKey.set(key, cities);
  return cities.slice();
}
