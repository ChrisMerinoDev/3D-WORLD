import { getCountries } from "@aurora/backend";
import { GEO_CACHE_CONTROL, jsonWithCache } from "../_lib/http";

/** GET /api/countries → Country[] */
export function GET(): Response {
  return jsonWithCache(getCountries(), GEO_CACHE_CONTROL);
}
