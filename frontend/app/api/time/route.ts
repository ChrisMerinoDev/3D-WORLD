import type { NextRequest } from "next/server";
import { getTimeInfo, InvalidTimezoneError } from "@aurora/backend";
import { NO_STORE, errorResponse, jsonWithCache } from "../_lib/http";

/**
 * GET /api/time?tz=<IANA> → TimeInfo
 * 400 when `tz` is missing or not a valid IANA timezone. Never cached.
 */
export function GET(request: NextRequest): Response {
  const tz = request.nextUrl.searchParams.get("tz");
  if (!tz) {
    return errorResponse(400, "missing_timezone", "Query parameter 'tz' is required.");
  }
  try {
    return jsonWithCache(getTimeInfo(tz), NO_STORE);
  } catch (err) {
    if (err instanceof InvalidTimezoneError) {
      return errorResponse(400, err.code, err.message);
    }
    throw err;
  }
}
