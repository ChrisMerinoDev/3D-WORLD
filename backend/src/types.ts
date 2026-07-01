/**
 * Aurora shared API contract.
 *
 * This file is the SINGLE SOURCE OF TRUTH for the data shapes exchanged
 * between the backend data services and the frontend. Both sides import
 * these types. Do not change a shape without updating both consumers.
 */

/** A geographic coordinate on Earth. */
export interface LatLng {
  lat: number;
  lng: number;
}

/** A country/territory. */
export interface Country {
  /** ISO 3166-1 alpha-2 code, e.g. "US". Primary key for a country. */
  iso2: string;
  /** ISO 3166-1 alpha-3 code, e.g. "USA". */
  iso3: string;
  /** English display name. */
  name: string;
  /** Emoji flag, e.g. "🇺🇸". */
  flag: string;
  /** Centroid used by the globe to fly-to. */
  lat: number;
  lng: number;
  /** IANA timezone identifiers associated with the country. */
  timezones: string[];
  /** The timezone the clock should default to for this country. */
  primaryTimezone: string;
  /** Capital city name, if known. */
  capital?: string;
  /** ISO 4217 currency code, if known. */
  currency?: string;
  /** Number of first-level subdivisions (states/regions). */
  stateCount: number;
}

/** A first-level subdivision (state / province / region). */
export interface State {
  /** ISO 3166-2 subdivision code (unique within its country). */
  iso: string;
  /** English display name. */
  name: string;
  /** Parent country ISO alpha-2. */
  countryIso2: string;
  /** Centroid, when available (may be null for regions without coords). */
  lat: number | null;
  lng: number | null;
  /** Number of cities in this subdivision. */
  cityCount: number;
}

/** A city / populated place. */
export interface City {
  /** Display name. */
  name: string;
  /** Parent state ISO 3166-2 code (may be empty for stateless entries). */
  stateIso: string;
  /** Parent country ISO alpha-2. */
  countryIso2: string;
  lat: number;
  lng: number;
  /** IANA timezone for the city, when derivable. */
  timezone?: string;
}

/** Authoritative time information for a timezone. */
export interface TimeInfo {
  /** IANA timezone identifier used, e.g. "America/New_York". */
  timezone: string;
  /** Current time as an ISO 8601 string in that zone. */
  iso: string;
  /** UTC offset in minutes (e.g. -240 for EDT). */
  offsetMinutes: number;
  /** Short zone abbreviation, e.g. "EDT". */
  abbreviation: string;
}

/** Standard error envelope returned by the API on failure. */
export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
