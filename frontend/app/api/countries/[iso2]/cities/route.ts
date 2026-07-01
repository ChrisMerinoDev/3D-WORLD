import { getCountryCities, DEFAULT_COUNTRY_CITIES_LIMIT } from "@aurora/backend";
import { GEO_CACHE_CONTROL, errorResponse, jsonWithCache } from "../../../_lib/http";

/** Bounds for the `limit` query param (protects payload size). */
const MIN_LIMIT = 1;
const MAX_LIMIT = 1000;

/** Parse + clamp `?limit=`; falls back to the service default when absent/invalid. */
function parseLimit(raw: string | null): number {
  if (raw === null || raw.trim() === "") return DEFAULT_COUNTRY_CITIES_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_COUNTRY_CITIES_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Math.floor(n)));
}

/**
 * GET /api/countries/:iso2/cities?limit=<n> → City[]
 *
 * Cities aggregated across every subdivision of the country, so a country always
 * surfaces places even when its regions individually carry zero cities.
 * 404 (`country_not_found`) when the country ISO is unknown.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ iso2: string }> },
): Promise<Response> {
  const { iso2 } = await params;
  const limit = parseLimit(new URL(request.url).searchParams.get("limit"));

  const cities = getCountryCities(iso2, limit);
  if (cities === null) {
    return errorResponse(404, "country_not_found", `Unknown country: ${iso2}`);
  }
  return jsonWithCache(cities, GEO_CACHE_CONTROL);
}
