/**
 * @aurora/backend — public service API.
 *
 * Framework-agnostic, synchronous, HTTP-free. The Next.js Route Handlers (and
 * tests) import from here; nothing in this package touches the network.
 */
export type { Country, State, City, TimeInfo, ApiError, LatLng } from "./types";

export {
  getCountries,
  getCountry,
  getStates,
  getCities,
  normalizeIsoCode,
} from "./services/geo";

export { getTimeInfo, isValidTimeZone, InvalidTimezoneError } from "./services/time";
