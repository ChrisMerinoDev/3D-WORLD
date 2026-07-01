import { describe, it, expect } from "vitest";
import { Country as CscCountry } from "country-state-city";
import { getCountries, getCountry, getStates, getCities, normalizeIsoCode } from "./geo.js";
import { COUNTRY_META } from "../data/countryMeta.js";
import { isValidTimeZone } from "./time.js";

describe("getCountries", () => {
  const countries = getCountries();

  it("returns a comprehensive, name-sorted list", () => {
    expect(countries.length).toBeGreaterThan(200);
    const names = countries.map((c) => c.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it("includes the United States with a correct, complete shape", () => {
    const us = countries.find((c) => c.iso2 === "US");
    expect(us).toBeDefined();
    expect(us!.iso3).toBe("USA");
    expect(us!.name).toBe("United States");
    expect(us!.flag).toBe("🇺🇸");
    expect(us!.capital).toBe("Washington, D.C.");
    expect(us!.currency).toBe("USD");
    expect(Number.isFinite(us!.lat)).toBe(true);
    expect(Number.isFinite(us!.lng)).toBe(true);
    expect(us!.stateCount).toBeGreaterThan(0);
    expect(us!.timezones.length).toBeGreaterThan(0);
    expect(isValidTimeZone(us!.primaryTimezone)).toBe(true);
  });

  it("picks a longitude-appropriate primary timezone (US → America/Chicago)", () => {
    const us = getCountry("us");
    // Centroid-based heuristic should land on Central time, not Hawaii-Aleutian.
    expect(us!.primaryTimezone).toBe("America/Chicago");
  });

  it("every country has a non-empty iso3 and a valid primary timezone", () => {
    for (const c of countries) {
      expect(c.iso3, `iso3 for ${c.iso2}`).toMatch(/^[A-Z]{3}$/);
      expect(isValidTimeZone(c.primaryTimezone), `tz for ${c.iso2}`).toBe(true);
    }
  });
});

describe("COUNTRY_META coverage", () => {
  it("covers every alpha-2 code the dataset returns", () => {
    const missing = CscCountry.getAllCountries()
      .map((c) => c.isoCode.toUpperCase())
      .filter((iso2) => !(iso2 in COUNTRY_META));
    expect(missing).toEqual([]);
  });
});

describe("getCountry / normalization", () => {
  it("is case-insensitive and trims", () => {
    expect(getCountry("  us  ")!.iso2).toBe("US");
    expect(getCountry("Us")!.iso2).toBe("US");
    expect(normalizeIsoCode(" gb ")).toBe("GB");
  });

  it("returns null for an unknown code", () => {
    expect(getCountry("ZZ")).toBeNull();
  });
});

describe("getStates", () => {
  it("returns states for a known country with cityCount", () => {
    const states = getStates("US");
    expect(states).not.toBeNull();
    expect(states!.length).toBeGreaterThan(0);
    const california = states!.find((s) => s.iso === "CA");
    expect(california).toBeDefined();
    expect(california!.countryIso2).toBe("US");
    expect(california!.name).toBe("California");
    expect(california!.cityCount).toBeGreaterThan(0);
  });

  it("returns null for an unknown country", () => {
    expect(getStates("ZZ")).toBeNull();
  });
});

describe("getCities", () => {
  it("returns cities with coordinates for a known state", () => {
    const cities = getCities("US", "CA");
    expect(cities).not.toBeNull();
    expect(cities!.length).toBeGreaterThan(0);
    for (const city of cities!.slice(0, 20)) {
      expect(city.countryIso2).toBe("US");
      expect(city.stateIso).toBe("CA");
      expect(Number.isFinite(city.lat)).toBe(true);
      expect(Number.isFinite(city.lng)).toBe(true);
    }
  });

  it("returns null for unknown country or unknown state", () => {
    expect(getCities("ZZ", "CA")).toBeNull();
    expect(getCities("US", "ZZ")).toBeNull();
  });

  it("populates city timezone only when the country is single-zone (JP)", () => {
    const jpStates = getStates("JP")!;
    expect(jpStates.length).toBeGreaterThan(0);
    const cities = getCities("JP", jpStates[0]!.iso)!;
    if (cities.length > 0) {
      expect(cities[0]!.timezone).toBe("Asia/Tokyo");
    }
  });
});
