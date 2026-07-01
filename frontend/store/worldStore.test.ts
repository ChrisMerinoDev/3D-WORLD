import { beforeEach, describe, expect, it, vi } from "vitest";
import type { City, Country, State } from "@aurora/backend/types";

// Mock the API boundary so the store never touches the network.
vi.mock("@/lib/api", () => ({
  api: {
    countries: vi.fn(),
    states: vi.fn(),
    cities: vi.fn(),
    // selectCountry fires loadCountryCities in parallel; default it to empty so
    // existing drill-down assertions are unaffected.
    countryCities: vi.fn().mockResolvedValue([]),
    time: vi.fn(),
  },
  ApiRequestError: class ApiRequestError extends Error {},
}));

import { api } from "@/lib/api";
import { useWorldStore } from "@/store/worldStore";

const mockApi = vi.mocked(api);

/* ---- fixtures ---- */
const US: Country = {
  iso2: "US",
  iso3: "USA",
  name: "United States",
  flag: "🇺🇸",
  lat: 38,
  lng: -97,
  timezones: ["America/New_York", "America/Los_Angeles"],
  primaryTimezone: "America/New_York",
  capital: "Washington",
  currency: "USD",
  stateCount: 50,
};
const FR: Country = {
  iso2: "FR",
  iso3: "FRA",
  name: "France",
  flag: "🇫🇷",
  lat: 46,
  lng: 2,
  timezones: ["Europe/Paris"],
  primaryTimezone: "Europe/Paris",
  capital: "Paris",
  currency: "EUR",
  stateCount: 13,
};
const CA: State = {
  iso: "US-CA",
  name: "California",
  countryIso2: "US",
  lat: 37,
  lng: -119,
  cityCount: 2,
};
const NY: State = {
  iso: "US-NY",
  name: "New York",
  countryIso2: "US",
  lat: 43,
  lng: -75,
  cityCount: 1,
};
const LA: City = {
  name: "Los Angeles",
  stateIso: "US-CA",
  countryIso2: "US",
  lat: 34.05,
  lng: -118.24,
  timezone: "America/Los_Angeles",
};
const JP: Country = {
  iso2: "JP",
  iso3: "JPN",
  name: "Japan",
  flag: "🇯🇵",
  lat: 36,
  lng: 138,
  timezones: ["Asia/Tokyo"],
  primaryTimezone: "Asia/Tokyo",
  capital: "Tokyo",
  currency: "JPY",
  stateCount: 47,
};
const TOKYO: City = {
  name: "Tokyo",
  stateIso: "JP-13",
  countryIso2: "JP",
  lat: 35.68,
  lng: 139.69,
  timezone: "Asia/Tokyo",
};

// Snapshot the pristine store (with its actions) once so we can reset per test.
const PRISTINE = useWorldStore.getState();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  useWorldStore.setState(PRISTINE, true);
});

describe("useWorldStore drill-down", () => {
  it("loadCountries populates countries and clears the loading flag", async () => {
    mockApi.countries.mockResolvedValue([US, FR]);
    await useWorldStore.getState().loadCountries();

    const s = useWorldStore.getState();
    expect(s.countries).toEqual([US, FR]);
    expect(s.loading.countries).toBe(false);
    expect(s.error).toBeUndefined();
  });

  it("selectCountry sets level, selection, timezone and loads states", async () => {
    mockApi.countries.mockResolvedValue([US, FR]);
    mockApi.states.mockResolvedValue([CA, NY]);
    await useWorldStore.getState().loadCountries();

    await useWorldStore.getState().selectCountry("US");

    const s = useWorldStore.getState();
    expect(s.level).toBe("country");
    expect(s.selectedCountry).toEqual(US);
    expect(s.activeTimezone).toBe("America/New_York");
    expect(s.states).toEqual([CA, NY]);
    expect(mockApi.states).toHaveBeenCalledWith("US");
  });

  it("selectState then selectCity walks to city level and sets the city timezone", async () => {
    mockApi.countries.mockResolvedValue([US]);
    mockApi.states.mockResolvedValue([CA]);
    mockApi.cities.mockResolvedValue([LA]);
    await useWorldStore.getState().loadCountries();
    await useWorldStore.getState().selectCountry("US");

    await useWorldStore.getState().selectState("US-CA");
    let s = useWorldStore.getState();
    expect(s.level).toBe("state");
    expect(s.selectedState).toEqual(CA);
    expect(s.cities).toEqual([LA]);
    expect(mockApi.cities).toHaveBeenCalledWith("US", "US-CA");

    useWorldStore.getState().selectCity(LA);
    s = useWorldStore.getState();
    expect(s.level).toBe("city");
    expect(s.selectedCity).toEqual(LA);
    expect(s.activeTimezone).toBe("America/Los_Angeles");
  });

  it("goBack steps up the hierarchy and restores timezones", async () => {
    mockApi.countries.mockResolvedValue([US]);
    mockApi.states.mockResolvedValue([CA]);
    mockApi.cities.mockResolvedValue([LA]);
    const store = useWorldStore.getState();
    await store.loadCountries();
    await store.selectCountry("US");
    await store.selectState("US-CA");
    store.selectCity(LA);

    store.goBack(); // city -> state
    expect(useWorldStore.getState().level).toBe("state");
    expect(useWorldStore.getState().activeTimezone).toBe("America/New_York");

    store.goBack(); // state -> country
    expect(useWorldStore.getState().level).toBe("country");
    expect(useWorldStore.getState().selectedState).toBeUndefined();
    expect(useWorldStore.getState().cities).toEqual([]);

    store.goBack(); // country -> world
    const s = useWorldStore.getState();
    expect(s.level).toBe("world");
    expect(s.selectedCountry).toBeUndefined();
    expect(s.states).toEqual([]);
  });

  it("reset returns to the world level and clears selections", async () => {
    mockApi.countries.mockResolvedValue([US]);
    mockApi.states.mockResolvedValue([CA]);
    await useWorldStore.getState().loadCountries();
    await useWorldStore.getState().selectCountry("US");

    useWorldStore.getState().reset();
    const s = useWorldStore.getState();
    expect(s.level).toBe("world");
    expect(s.selectedCountry).toBeUndefined();
    expect(s.selectedState).toBeUndefined();
    expect(s.states).toEqual([]);
    expect(s.error).toBeUndefined();
  });
});

describe("country-wide cities (Cities tab)", () => {
  it("selectCountry kicks off loadCountryCities with the configured limit", async () => {
    mockApi.countries.mockResolvedValue([JP]);
    mockApi.states.mockResolvedValue([]);
    mockApi.countryCities.mockResolvedValue([TOKYO]);
    await useWorldStore.getState().loadCountries();

    await useWorldStore.getState().selectCountry("JP");

    expect(mockApi.countryCities).toHaveBeenCalledWith("JP", 250);
  });

  it("loadCountryCities populates countryCities (capital first) and clears loading", async () => {
    mockApi.countryCities.mockResolvedValue([TOKYO]);
    // Guard checks the current selection, so pin selectedCountry to JP first.
    useWorldStore.setState({ selectedCountry: JP });

    await useWorldStore.getState().loadCountryCities("JP");

    const s = useWorldStore.getState();
    expect(s.countryCities).toEqual([TOKYO]);
    expect(s.loading.countryCities).toBe(false);
    expect(s.countryCitiesError).toBeUndefined();
  });

  it("surfaces a country-cities error without touching the generic error", async () => {
    mockApi.countryCities.mockRejectedValue(new Error("boom"));
    useWorldStore.setState({ selectedCountry: JP });

    await useWorldStore.getState().loadCountryCities("JP");

    const s = useWorldStore.getState();
    expect(s.countryCitiesError).toBe("boom");
    expect(s.countryCities).toEqual([]);
    expect(s.loading.countryCities).toBe(false);
    expect(s.error).toBeUndefined();
  });

  it("discards a stale country-cities response after the country changes", async () => {
    const jpCities = deferred<City[]>();
    mockApi.countryCities.mockImplementation((iso: string) =>
      iso === "JP" ? jpCities.promise : Promise.resolve([]),
    );
    useWorldStore.setState({ selectedCountry: JP });

    const pending = useWorldStore.getState().loadCountryCities("JP");
    // Switch the active country while JP's cities are still in flight.
    useWorldStore.setState({ selectedCountry: FR });

    jpCities.resolve([TOKYO]);
    await pending;

    // The stale JP payload must be discarded (list stays empty from the reset).
    expect(useWorldStore.getState().countryCities).toEqual([]);
    expect(useWorldStore.getState().selectedCountry?.iso2).toBe("FR");
  });
});

describe("out-of-order async guards", () => {
  it("discards a stale states response after the country selection changes", async () => {
    mockApi.countries.mockResolvedValue([US, FR]);
    await useWorldStore.getState().loadCountries();

    const usStates = deferred<State[]>();
    mockApi.states.mockImplementation((iso: string) =>
      iso === "US" ? usStates.promise : Promise.resolve([]),
    );

    // Start US selection (states pending), then switch to FR which resolves fast.
    const pendingUs = useWorldStore.getState().selectCountry("US");
    await useWorldStore.getState().selectCountry("FR");
    expect(useWorldStore.getState().selectedCountry?.iso2).toBe("FR");

    // Now the stale US response arrives — it must be discarded.
    usStates.resolve([CA, NY]);
    await pendingUs;

    const s = useWorldStore.getState();
    expect(s.selectedCountry?.iso2).toBe("FR");
    expect(s.states).toEqual([]); // FR's (empty) result, not the stale US states
  });

  it("discards a stale cities response after the state selection changes", async () => {
    mockApi.countries.mockResolvedValue([US]);
    mockApi.states.mockResolvedValue([CA, NY]);
    await useWorldStore.getState().loadCountries();
    await useWorldStore.getState().selectCountry("US");

    const caCities = deferred<City[]>();
    mockApi.cities.mockImplementation((_iso2: string, stateIso: string) =>
      stateIso === "US-CA" ? caCities.promise : Promise.resolve([]),
    );

    const pendingCa = useWorldStore.getState().selectState("US-CA");
    await useWorldStore.getState().selectState("US-NY");
    expect(useWorldStore.getState().selectedState?.iso).toBe("US-NY");

    caCities.resolve([LA]);
    await pendingCa;

    const s = useWorldStore.getState();
    expect(s.selectedState?.iso).toBe("US-NY");
    expect(s.cities).toEqual([]); // NY's (empty) result, stale CA cities discarded
  });
});
