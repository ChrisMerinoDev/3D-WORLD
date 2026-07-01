import { getCities } from "@aurora/backend";
import { GEO_CACHE_CONTROL, errorResponse, jsonWithCache } from "../../../../../_lib/http";

/**
 * GET /api/countries/:iso2/states/:stateIso/cities → City[]
 * 404 if either the country or the subdivision is unknown.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ iso2: string; stateIso: string }> },
): Promise<Response> {
  const { iso2, stateIso } = await params;
  const cities = getCities(iso2, stateIso);
  if (cities === null) {
    return errorResponse(
      404,
      "location_not_found",
      `Unknown country/state: ${iso2}/${stateIso}`,
    );
  }
  return jsonWithCache(cities, GEO_CACHE_CONTROL);
}
