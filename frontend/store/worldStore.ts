/**
 * Aurora drill-down store — the central integration seam.
 *
 * BOTH the 3D globe and the HUD talk to the app exclusively through this store:
 *  - The globe reads `selectedCountry/State/City` (for fly-to targets) and the
 *    loaded `countries/states/cities` (to render markers), and calls the
 *    `select*` / `goBack` actions on user interaction.
 *  - The HUD reads `activeTimezone` (clock + date), `level`, and the current
 *    selection (breadcrumb), and may call `goBack` / `reset`.
 *
 * Do not fetch data in components; call the async actions here.
 */
import { create } from "zustand";
import type { Country, State, City } from "@aurora/backend/types";
import { api } from "@/lib/api";

export type DrillLevel = "world" | "country" | "state" | "city";

/** How many country-wide cities to request per country. */
const COUNTRY_CITIES_LIMIT = 250;

interface LoadingFlags {
  countries: boolean;
  states: boolean;
  cities: boolean;
  /** Country-wide cities (the "Cities" tab at country level). */
  countryCities: boolean;
}

export interface WorldStore {
  // ---- navigation ----
  level: DrillLevel;

  // ---- loaded data ----
  countries: Country[];
  states: State[];
  cities: City[];
  /**
   * Cities aggregated across the whole selected country (capital first). Lets
   * the navigator show a country's cities directly, even when its regions carry
   * zero cities individually. Populated on `selectCountry` / `loadCountryCities`.
   */
  countryCities: City[];

  // ---- current selection ----
  selectedCountry?: Country;
  selectedState?: State;
  selectedCity?: City;

  // ---- derived ----
  /** IANA timezone that drives the world clock + date panel. */
  activeTimezone: string;

  loading: LoadingFlags;
  error?: string;
  /** Error specific to the country-wide cities load (kept separate from `error`). */
  countryCitiesError?: string;

  // ---- actions ----
  loadCountries: () => Promise<void>;
  selectCountry: (iso2: string) => Promise<void>;
  /** Load the whole-country city list (called by `selectCountry`; re-callable for retry). */
  loadCountryCities: (iso2: string) => Promise<void>;
  selectState: (iso: string) => Promise<void>;
  selectCity: (city: City) => void;
  goBack: () => void;
  reset: () => void;
}

/** Browser's timezone, used as the default before any selection. */
function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export const useWorldStore = create<WorldStore>((set, get) => ({
  level: "world",
  countries: [],
  states: [],
  cities: [],
  countryCities: [],
  activeTimezone: browserTimezone(),
  loading: { countries: false, states: false, cities: false, countryCities: false },

  async loadCountries() {
    if (get().countries.length > 0 || get().loading.countries) return;
    set((s) => ({ loading: { ...s.loading, countries: true }, error: undefined }));
    try {
      const countries = await api.countries();
      set((s) => ({ countries, loading: { ...s.loading, countries: false } }));
    } catch (e) {
      set((s) => ({
        loading: { ...s.loading, countries: false },
        error: e instanceof Error ? e.message : "Failed to load countries",
      }));
    }
  },

  async selectCountry(iso2) {
    const country = get().countries.find((c) => c.iso2 === iso2);
    if (!country) return;
    set((s) => ({
      selectedCountry: country,
      selectedState: undefined,
      selectedCity: undefined,
      states: [],
      cities: [],
      countryCities: [],
      level: "country",
      activeTimezone: country.primaryTimezone || s.activeTimezone,
      loading: { ...s.loading, states: true },
      error: undefined,
      countryCitiesError: undefined,
    }));
    // Load the whole-country city list in parallel (non-blocking) so users can
    // see cities immediately, even for countries whose regions have none.
    void get().loadCountryCities(iso2);
    try {
      const states = await api.states(iso2);
      // Discard if the selection changed while awaiting (out-of-order guard).
      if (get().selectedCountry?.iso2 !== iso2) return;
      set((s) => ({ states, loading: { ...s.loading, states: false } }));
    } catch (e) {
      if (get().selectedCountry?.iso2 !== iso2) return;
      set((s) => ({
        loading: { ...s.loading, states: false },
        error: e instanceof Error ? e.message : "Failed to load states",
      }));
    }
  },

  async loadCountryCities(iso2) {
    set((s) => ({
      countryCities: [],
      loading: { ...s.loading, countryCities: true },
      countryCitiesError: undefined,
    }));
    try {
      const cities = await api.countryCities(iso2, COUNTRY_CITIES_LIMIT);
      // Discard if the country selection changed while awaiting.
      if (get().selectedCountry?.iso2 !== iso2) return;
      set((s) => ({ countryCities: cities, loading: { ...s.loading, countryCities: false } }));
    } catch (e) {
      if (get().selectedCountry?.iso2 !== iso2) return;
      set((s) => ({
        loading: { ...s.loading, countryCities: false },
        countryCitiesError: e instanceof Error ? e.message : "Failed to load cities",
      }));
    }
  },

  async selectState(iso) {
    const state = get().states.find((st) => st.iso === iso);
    const country = get().selectedCountry;
    if (!state || !country) return;
    set((s) => ({
      selectedState: state,
      selectedCity: undefined,
      cities: [],
      level: "state",
      loading: { ...s.loading, cities: true },
      error: undefined,
    }));
    try {
      const cities = await api.cities(country.iso2, iso);
      // Discard if the selection changed while awaiting (out-of-order guard).
      if (get().selectedState?.iso !== iso || get().selectedCountry?.iso2 !== country.iso2)
        return;
      set((s) => ({ cities, loading: { ...s.loading, cities: false } }));
    } catch (e) {
      if (get().selectedState?.iso !== iso || get().selectedCountry?.iso2 !== country.iso2)
        return;
      set((s) => ({
        loading: { ...s.loading, cities: false },
        error: e instanceof Error ? e.message : "Failed to load cities",
      }));
    }
  },

  selectCity(city) {
    set((s) => ({
      selectedCity: city,
      level: "city",
      activeTimezone:
        city.timezone || s.selectedCountry?.primaryTimezone || s.activeTimezone,
    }));
  },

  goBack() {
    const { level, selectedCountry } = get();
    if (level === "city") {
      set((s) => ({
        level: "state",
        selectedCity: undefined,
        activeTimezone: selectedCountry?.primaryTimezone || s.activeTimezone,
      }));
    } else if (level === "state") {
      set({ level: "country", selectedState: undefined, cities: [] });
    } else if (level === "country") {
      set({
        level: "world",
        selectedCountry: undefined,
        selectedState: undefined,
        states: [],
        cities: [],
        countryCities: [],
        activeTimezone: browserTimezone(),
        countryCitiesError: undefined,
      });
    }
  },

  reset() {
    set({
      level: "world",
      selectedCountry: undefined,
      selectedState: undefined,
      selectedCity: undefined,
      states: [],
      cities: [],
      countryCities: [],
      activeTimezone: browserTimezone(),
      error: undefined,
      countryCitiesError: undefined,
    });
  },
}));
