import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiRequestError } from "@/lib/api";

/** Build a Response-like stub for the fetch mock. */
function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client — request paths", () => {
  it("countries() GETs /api/countries", async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ iso2: "US" }]));
    const result = await api.countries();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/countries");
    expect(opts).toMatchObject({ headers: { accept: "application/json" } });
    expect(result).toEqual([{ iso2: "US" }]);
  });

  it("states(iso2) GETs the nested states path with encoding", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    await api.states("US");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/countries/US/states");
  });

  it("cities(iso2, stateIso) GETs the nested cities path", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    await api.cities("US", "US-CA");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/countries/US/states/US-CA/cities");
  });

  it("time(tz) GETs /api/time with an encoded tz query", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ timezone: "America/New_York" }));
    await api.time("America/New_York");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/time?tz=America%2FNew_York");
  });

  it("forwards the AbortSignal", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    const controller = new AbortController();
    await api.countries(controller.signal);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal: controller.signal });
  });
});

describe("api client — error handling", () => {
  it("throws ApiRequestError with the parsed code/message/status", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { code: "not_found", message: "Unknown country" } },
        { ok: false, status: 404 },
      ),
    );

    await expect(api.states("ZZ")).rejects.toMatchObject({
      name: "ApiRequestError",
      code: "not_found",
      message: "Unknown country",
      status: 404,
    });
    await expect(api.states("ZZ")).rejects.toBeInstanceOf(ApiRequestError);
  });

  it("falls back to defaults when the error body is not JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);

    await expect(api.countries()).rejects.toMatchObject({
      code: "http_error",
      status: 500,
      message: "Request failed (500)",
    });
  });
});
