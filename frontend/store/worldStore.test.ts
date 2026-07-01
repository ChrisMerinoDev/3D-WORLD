import { beforeEach, describe, expect, it, vi } from "vitest";
import type { City, Country, State } from "@aurora/backend/types";

// Mock the API boundary so the store never touches the network.
vi.mock("@/lib/api", () => ({
  api: {
    countries: vi.fn(),
    states: vi.fn(),
    cities: vi.fn(),
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
