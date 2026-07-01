/**
 * Shared HTTP helpers for the Aurora Route Handlers.
 *
 * Lives under an underscore-prefixed folder so Next.js does not treat it as a
 * routable segment. Keeps the handlers thin: parse → delegate → serialize.
 */
import type { ApiError } from "@aurora/backend";

/**
 * Reference geo data is immutable within a deploy: cache hard at the edge and
 * allow long stale-while-revalidate so cold origins never block the globe.
 */
export const GEO_CACHE_CONTROL = "public, s-maxage=86400, stale-while-revalidate=604800";

/** Live time must never be cached. */
export const NO_STORE = "no-store";

/** JSON success response with an explicit Cache-Control header. */
export function jsonWithCache<T>(data: T, cacheControl: string): Response {
  return Response.json(data, {
    status: 200,
    headers: { "Cache-Control": cacheControl },
  });
}

/** RFC-style error envelope `{ error: { code, message } }` with no caching. */
export function errorResponse(status: number, code: string, message: string): Response {
  const body: ApiError = { error: { code, message } };
  return Response.json(body, {
    status,
    headers: { "Cache-Control": NO_STORE },
  });
}
