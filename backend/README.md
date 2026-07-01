# @aurora/backend

Framework-agnostic geospatial (country → state → city) and timezone data
services for the Aurora 3D World Map, plus the Next.js Route Handlers that expose
them.

## Design

- **Data source:** [`country-state-city`](https://www.npmjs.com/package/country-state-city)
  v3 (bundled, in-memory — no network I/O).
- **Indexes:** countries are built once at module load into a name-sorted array +
  `Map<iso2>` (O(1) lookup). States and cities are derived **lazily per
  country/state and memoized**, keeping cold start cheap while warm invocations
  never recompute a subtree.
- **iso3 + capital:** the dataset lacks these, so `src/data/countryMeta.ts`
  backfills a static ISO 3166-1 alpha-2 → { alpha-3, capital } table covering all
  250 codes (coverage is asserted in tests).
- **Timezones:** offset/abbreviation/ISO computed from the platform `Intl` (ICU)
  APIs — no timezone-database dependency. `primaryTimezone` is chosen by matching
  the country centroid longitude to the closest zone offset (so US → Central,
  not Hawaii–Aleutian).
- **Types:** every shape is defined once in `src/types.ts` (the shared contract)
  and imported by both the services and the frontend. Strict TypeScript, no
  `any` at boundaries.

## Service API (`import { ... } from "@aurora/backend"`)

| Function | Returns | Notes |
| --- | --- | --- |
| `getCountries()` | `Country[]` | All countries, sorted by name. |
| `getCountry(iso2)` | `Country \| null` | Case-insensitive; `null` if unknown. |
| `getStates(iso2)` | `State[] \| null` | `null` if the country is unknown. |
| `getCities(iso2, stateIso)` | `City[] \| null` | `null` if country or state is unknown. |
| `getTimeInfo(tz, now?)` | `TimeInfo` | Throws `InvalidTimezoneError` on a bad zone. |
| `isValidTimeZone(tz)` | `boolean` | IANA validity check. |

## HTTP endpoints (Next.js Route Handlers)

Geo endpoints send `Cache-Control: public, s-maxage=86400,
stale-while-revalidate=604800`. `/time` sends `Cache-Control: no-store`. Errors
use the envelope `{ "error": { "code", "message" } }`.

### `GET /api/countries` → `Country[]`

```json
[
  {
    "iso2": "US",
    "iso3": "USA",
    "name": "United States",
    "flag": "🇺🇸",
    "lat": 38,
    "lng": -97,
    "timezones": ["America/Adak", "America/New_York", "..."],
    "primaryTimezone": "America/Chicago",
    "capital": "Washington, D.C.",
    "currency": "USD",
    "stateCount": 66
  }
]
```

### `GET /api/countries/:iso2/states` → `State[]`

`GET /api/countries/US/states`

```json
[
  {
    "iso": "CA",
    "name": "California",
    "countryIso2": "US",
    "lat": 36.778261,
    "lng": -119.417932,
    "cityCount": 1123
  }
]
```

404 when the country is unknown:

```json
{ "error": { "code": "country_not_found", "message": "Unknown country code: ZZ" } }
```

### `GET /api/countries/:iso2/states/:stateIso/cities` → `City[]`

`GET /api/countries/US/states/CA/cities`

```json
[
  {
    "name": "Acalanes Ridge",
    "stateIso": "CA",
    "countryIso2": "US",
    "lat": 37.90472,
    "lng": -122.07857
  }
]
```

`timezone` is included only when the country has a single timezone (unambiguous).
404 (`location_not_found`) when the country or state is unknown.

### `GET /api/time?tz=<IANA>` → `TimeInfo`

`GET /api/time?tz=America/New_York`

```json
{
  "timezone": "America/New_York",
  "iso": "2026-06-30T08:00:00-04:00",
  "offsetMinutes": -240,
  "abbreviation": "EDT"
}
```

400 on a missing (`missing_timezone`) or invalid (`invalid_timezone`) zone:

```json
{ "error": { "code": "invalid_timezone", "message": "Invalid IANA timezone: \"Mars/Phobos\"" } }
```

## Development

```bash
npm run typecheck   # tsc --noEmit
npm run test        # vitest run
```
