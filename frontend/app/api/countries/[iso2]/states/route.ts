import { getStates } from "@aurora/backend";
import { GEO_CACHE_CONTROL, errorResponse, jsonWithCache } from "../../../_lib/http";

/** GET /api/countries/:iso2/states → State[] (404 if the country is unknown). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ iso2: string }> },
): Promise<Response> {
  const { iso2 } = await params;
  const states = getStates(iso2);
  if (states === null) {
    return errorResponse(404, "country_not_found", `Unknown country code: ${iso2}`);
  }
  return jsonWithCache(states, GEO_CACHE_CONTROL);
}
