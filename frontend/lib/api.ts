/**
 * Typed data client for the Aurora API.
 *
 * All calls go through the Next.js Route Handlers under NEXT_PUBLIC_API_BASE_URL
 * (default "/api"). The response shapes come from the shared backend contract.
 */
import type { Country, State, City, TimeInfo, ApiError } from "@aurora/backend/types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    signal,
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    let code = "http_error";
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as ApiError;
      if (body?.error) {
        code = body.error.code ?? code;
        message = body.error.message ?? message;
      }
    } catch {
      /* non-JSON error body; keep defaults */
    }
    throw new ApiRequestError(code, message, res.status);
  }
  return (await res.json()) as T;
}

export const api = {
  /** All countries with centroids + timezones. */
  countries: (signal?: AbortSignal) => get<Country[]>("/countries", signal),

  /** First-level subdivisions for a country (ISO alpha-2). */
  states: (countryIso2: string, signal?: AbortSignal) =>
    get<State[]>(`/countries/${encodeURIComponent(countryIso2)}/states`, signal),

  /** Cities for a subdivision. */
  cities: (countryIso2: string, stateIso: string, signal?: AbortSignal) =>
    get<City[]>(
      `/countries/${encodeURIComponent(countryIso2)}/states/${encodeURIComponent(stateIso)}/cities`,
      signal,
    ),

  /**
   * Cities aggregated across a whole country (capital first), so a country
   * always surfaces places even when its individual regions carry zero cities.
   */
  countryCities: (countryIso2: string, limit?: number, signal?: AbortSignal) =>
    get<City[]>(
      `/countries/${encodeURIComponent(countryIso2)}/cities${
        limit != null ? `?limit=${encodeURIComponent(limit)}` : ""
      }`,
      signal,
    ),

  /** Authoritative time info for an IANA timezone. */
  time: (timezone: string, signal?: AbortSignal) =>
    get<TimeInfo>(`/time?tz=${encodeURIComponent(timezone)}`, signal),
};

export { ApiRequestError };
