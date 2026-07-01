"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import type { Country, State, City } from "@aurora/backend/types";
import { useWorldStore, type DrillLevel } from "@/store/worldStore";
import { LEVEL_ACCENT, LEVEL_LABEL } from "./levelAccent";

/** Stable id so the collapse/reopen controls can reference the panel (a11y). */
const PANEL_ID = "aurora-navigator-panel";
/** Stable id linking the Cities/Regions tabs to their content region (a11y). */
const LIST_REGION_ID = "aurora-navigator-list-region";

/**
 * The kind of item a level (and, at country level, the active tab) is showing.
 * Drives filtering, row rendering and selection.
 */
type ListKind = "country" | "state" | "countryCity" | "city";
type CountryTab = "cities" | "regions";
type ListItem = Country | State | City;

function itemName(item: ListItem): string {
  return item.name;
}

/**
 * Level-aware navigator. Lets users drill via the UI (not only the globe):
 * countries → states → cities → city detail. Adds live search + submit, a
 * "Cities | Regions" tab at country level (so cities always surface even when
 * regions are empty), and a collapse/reopen affordance. Every async section
 * handles loading (skeletons, no layout shift), error (retry) and empty states.
 */
export function NavigatorPanel() {
  const [open, setOpen] = useState(true);
  const reduce = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      {open ? (
        <PanelShell key="panel" reduce={reduce} onCollapse={() => setOpen(false)} />
      ) : (
        <ReopenHandle key="handle" reduce={reduce} onOpen={() => setOpen(true)} />
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* Panel shell (search + tabs + list) + collapse animation            */
/* ------------------------------------------------------------------ */
function PanelShell({
  reduce,
  onCollapse,
}: {
  reduce: boolean | null;
  onCollapse: () => void;
}) {
  const level = useWorldStore((s) => s.level);
  const country = useWorldStore((s) => s.selectedCountry);
  const state = useWorldStore((s) => s.selectedState);

  const selectCountry = useWorldStore((s) => s.selectCountry);
  const selectState = useWorldStore((s) => s.selectState);
  const selectCity = useWorldStore((s) => s.selectCity);

  // Data sources (each is a stable array reference from the store).
  const countries = useWorldStore((s) => s.countries);
  const states = useWorldStore((s) => s.states);
  const cities = useWorldStore((s) => s.cities);
  const countryCities = useWorldStore((s) => s.countryCities);

  const [tab, setTab] = useState<CountryTab>("cities");
  const [query, setQuery] = useState("");

  // Reset the country tab to "Cities" whenever the country changes. Done during
  // render (the React-recommended "store previous value in state" pattern)
  // rather than in an effect, to avoid cascading-render churn.
  const [prevCountry, setPrevCountry] = useState(country?.iso2);
  if (prevCountry !== country?.iso2) {
    setPrevCountry(country?.iso2);
    setTab("cities");
  }

  // Reset the search query whenever the drill "view" changes (level, selection
  // or tab). Same render-phase reset pattern.
  const resetKey = `${level}:${country?.iso2 ?? ""}:${state?.iso ?? ""}:${tab}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setQuery("");
  }

  // Resolve the active list kind + items for the current view.
  const { kind, items } = useMemo((): { kind: ListKind; items: ListItem[] } => {
    if (level === "world") return { kind: "country", items: countries };
    if (level === "country")
      return tab === "cities"
        ? { kind: "countryCity", items: countryCities }
        : { kind: "state", items: states };
    if (level === "state") return { kind: "city", items: cities };
    return { kind: "city", items: [] };
  }, [level, tab, countries, states, cities, countryCities]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => itemName(it).toLowerCase().includes(q));
  }, [items, query]);

  const onSelect = useCallback(
    (item: ListItem) => {
      switch (kind) {
        case "country":
          void selectCountry((item as Country).iso2);
          break;
        case "state":
          void selectState((item as State).iso);
          break;
        default:
          selectCity(item as City);
      }
    },
    [kind, selectCountry, selectState, selectCity],
  );

  // Enter / submit: pick an exact name match, else the sole remaining match.
  const onSubmit = useCallback(() => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    const exact = items.find((it) => itemName(it).toLowerCase() === q);
    const target = exact ?? (filtered.length === 1 ? filtered[0] : undefined);
    if (target) onSelect(target);
  }, [query, items, filtered, onSelect]);

  const searchable = level !== "city";
  const viewKey =
    level === "world"
      ? "world"
      : level === "country"
        ? `country:${country?.iso2}:${tab}`
        : level === "state"
          ? `state:${state?.iso}`
          : "city";

  return (
    <motion.aside
      id={PANEL_ID}
      aria-label="Location navigator"
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: -32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: "-115%" }}
      transition={{ duration: reduce ? 0.15 : 0.42, ease: [0.4, 0, 0.2, 1] }}
      className="glass pointer-events-auto absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] flex max-h-[52vh] flex-col overflow-hidden rounded-2xl sm:inset-x-auto sm:bottom-6 sm:left-[calc(env(safe-area-inset-left,0px)+1.5rem)] sm:max-h-[min(32rem,72vh)] sm:w-[22rem]"
    >
      <Header level={level} onCollapse={onCollapse} />

      {searchable && (
        <div className="flex flex-col gap-2.5 border-b border-white/8 px-3 py-2.5">
          {level === "country" && <SegmentedTabs tab={tab} onChange={setTab} />}
          <SearchBar
            value={query}
            onChange={setQuery}
            onSubmit={onSubmit}
            onClear={() => setQuery("")}
            placeholder={SEARCH_PLACEHOLDER[kind]}
          />
        </div>
      )}

      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={viewKey}
            id={LIST_REGION_ID}
            role={level === "country" ? "tabpanel" : undefined}
            initial={reduce ? false : { opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="aurora-scroll h-full overflow-y-auto px-3 pb-3"
          >
            {level === "city" ? (
              <CityDetail />
            ) : (
              <NavigatorList
                kind={kind}
                filtered={filtered}
                hasItems={items.length > 0}
                query={query}
                onSelect={onSelect}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}

const SEARCH_PLACEHOLDER: Record<ListKind, string> = {
  country: "Search countries…",
  state: "Search regions…",
  countryCity: "Search cities…",
  city: "Search cities…",
};

/* ------------------------------------------------------------------ */
/* Reopen handle (shown when the panel is collapsed)                   */
/* ------------------------------------------------------------------ */
function ReopenHandle({
  reduce,
  onOpen,
}: {
  reduce: boolean | null;
  onOpen: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      aria-label="Open location navigator"
      aria-expanded={false}
      aria-controls={PANEL_ID}
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
      transition={{ duration: reduce ? 0.15 : 0.32, ease: [0.4, 0, 0.2, 1] }}
      className="glass pointer-events-auto absolute bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] left-3 flex h-11 items-center gap-2 rounded-full pl-3 pr-4 sm:bottom-6 sm:left-[calc(env(safe-area-inset-left,0px)+1.5rem)]"
    >
      <Chevron dir="right" />
      <span className="font-display text-[0.72rem] uppercase tracking-[0.24em] text-ink/85">
        Explore
      </span>
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* Header (with collapse control)                                     */
/* ------------------------------------------------------------------ */
function Header({ level, onCollapse }: { level: DrillLevel; onCollapse: () => void }) {
  const country = useWorldStore((s) => s.selectedCountry);
  const state = useWorldStore((s) => s.selectedState);
  const city = useWorldStore((s) => s.selectedCity);
  const counts = useWorldStore(
    useShallow((s) => ({
      countries: s.countries.length,
      states: s.states.length,
      cities: s.cities.length,
    })),
  );
  const loading = useWorldStore(
    useShallow((s) => ({ countries: s.loading.countries, states: s.loading.states })),
  );

  const accent = LEVEL_ACCENT[level];
  let title = "Explore Earth";
  let meta = loading.countries ? "Loading countries…" : `${counts.countries} countries`;
  let flag: string | undefined;

  if (level === "country" && country) {
    title = country.name;
    flag = country.flag;
    meta = loading.states
      ? "Loading regions…"
      : [country.capital && `Capital ${country.capital}`, country.currency, `${country.stateCount} regions`]
          .filter(Boolean)
          .join(" · ");
  } else if (level === "state" && state) {
    title = state.name;
    meta = `${state.cityCount} cities`;
  } else if (level === "city" && city) {
    title = city.name;
    meta = "City focus";
  }

  return (
    <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
      <span
        aria-hidden
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: accent, boxShadow: `0 0 10px 1px ${accent}` }}
      />
      <div className="min-w-0 flex-1">
        <div className="font-display text-[0.55rem] uppercase tracking-[0.32em] text-ink/45">
          {LEVEL_LABEL[level]}
        </div>
        <div className="flex items-center gap-2 truncate font-display text-base font-medium text-ink">
          {flag && <span aria-hidden>{flag}</span>}
          <span className="truncate">{title}</span>
        </div>
        <div className="truncate font-mono text-[0.62rem] text-ink/45">{meta}</div>
      </div>
      <button
        type="button"
        onClick={onCollapse}
        aria-label="Collapse location navigator"
        aria-expanded
        aria-controls={PANEL_ID}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-ink/80 transition-colors hover:bg-aurora/15 hover:text-aurora"
      >
        <Chevron dir="left" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cities | Regions tabs                                              */
/* ------------------------------------------------------------------ */
function SegmentedTabs({
  tab,
  onChange,
}: {
  tab: CountryTab;
  onChange: (t: CountryTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Show cities or regions"
      className="flex rounded-full border border-white/10 bg-white/[0.04] p-0.5"
    >
      {(["cities", "regions"] as const).map((t) => {
        const active = tab === t;
        return (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={LIST_REGION_ID}
            onClick={() => onChange(t)}
            className={`h-9 flex-1 rounded-full font-display text-[0.72rem] uppercase tracking-[0.18em] transition-colors ${
              active ? "bg-aurora/18 text-aurora" : "text-ink/55 hover:text-ink"
            }`}
          >
            {t === "cities" ? "Cities" : "Regions"}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Search bar with visible submit + clear                             */
/* ------------------------------------------------------------------ */
function SearchBar({
  value,
  onChange,
  onSubmit,
  onClear,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  placeholder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex items-center gap-2"
    >
      <div className="relative flex-1">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35"
        >
          <MagnifierIcon />
        </span>
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          aria-label={placeholder}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-9 pr-9 font-display text-[0.82rem] text-ink placeholder:text-ink/35 focus:border-aurora/50 focus:outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onClear();
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink/45 transition-colors hover:bg-white/10 hover:text-ink"
          >
            <span aria-hidden className="text-base leading-none">
              ×
            </span>
          </button>
        )}
      </div>
      <button
        type="submit"
        aria-label="Search"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-aurora/40 bg-aurora/15 text-aurora transition-colors hover:bg-aurora/25"
      >
        <MagnifierIcon />
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* List (per view) with loading / error / empty                      */
/* ------------------------------------------------------------------ */
function NavigatorList({
  kind,
  filtered,
  hasItems,
  query,
  onSelect,
}: {
  kind: ListKind;
  filtered: ListItem[];
  hasItems: boolean;
  query: string;
  onSelect: (item: ListItem) => void;
}) {
  const loading = useWorldStore(
    useShallow((s) => ({
      country: s.loading.countries,
      state: s.loading.states,
      city: s.loading.cities,
      countryCity: s.loading.countryCities,
    })),
  );
  const genericError = useWorldStore((s) => s.error);
  const countryCitiesError = useWorldStore((s) => s.countryCitiesError);
  const country = useWorldStore((s) => s.selectedCountry);
  const state = useWorldStore((s) => s.selectedState);
  const loadCountries = useWorldStore((s) => s.loadCountries);
  const loadCountryCities = useWorldStore((s) => s.loadCountryCities);
  const selectCountry = useWorldStore((s) => s.selectCountry);
  const selectState = useWorldStore((s) => s.selectState);

  const isLoading =
    kind === "country"
      ? loading.country
      : kind === "state"
        ? loading.state
        : kind === "countryCity"
          ? loading.countryCity
          : loading.city;

  const error = kind === "countryCity" ? countryCitiesError : genericError;

  const retry = (): void => {
    if (kind === "country") void loadCountries();
    else if (kind === "state" && country) void selectCountry(country.iso2);
    else if (kind === "countryCity" && country) void loadCountryCities(country.iso2);
    else if (kind === "city" && state) void selectState(state.iso);
  };

  if (isLoading && !hasItems) return <SkeletonRows />;
  if (error && !hasItems) return <ErrorState message={error} onRetry={retry} />;
  if (!hasItems) return <EmptyState message={EMPTY_MESSAGE[kind]} />;
  if (filtered.length === 0)
    return <EmptyState message={`No matches for “${query.trim()}”.`} />;

  return (
    <ul className="mt-2 space-y-0.5">
      {filtered.map((item) => (
        <ListRow key={rowKey(kind, item)} kind={kind} item={item} onSelect={onSelect} />
      ))}
    </ul>
  );
}

const EMPTY_MESSAGE: Record<ListKind, string> = {
  country: "No countries available.",
  state: "No subdivisions available for this country.",
  countryCity: "No cities available for this country.",
  city: "No cities available for this region.",
};

function rowKey(kind: ListKind, item: ListItem): string {
  if (kind === "country") return (item as Country).iso2;
  if (kind === "state") return (item as State).iso;
  const c = item as City;
  return `${c.name}:${c.lat},${c.lng}`;
}

/* ------------------------------------------------------------------ */
/* City detail (city level)                                          */
/* ------------------------------------------------------------------ */
function CityDetail() {
  const city = useWorldStore((s) => s.selectedCity);
  const state = useWorldStore((s) => s.selectedState);
  const country = useWorldStore((s) => s.selectedCountry);
  if (!city) return <EmptyState message="No city selected." />;

  const rows: Array<[string, string]> = [
    ["Region", state?.name ?? "—"],
    ["Country", country ? `${country.flag} ${country.name}` : "—"],
    ["Timezone", city.timezone ?? "—"],
    ["Latitude", city.lat.toFixed(4)],
    ["Longitude", city.lng.toFixed(4)],
  ];

  return (
    <dl className="mt-3 space-y-2.5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4">
          <dt className="font-display text-[0.58rem] uppercase tracking-[0.24em] text-ink/40">
            {label}
          </dt>
          <dd className="truncate text-right font-mono text-[0.78rem] text-ink/85">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/* Shared row + states                                                */
/* ------------------------------------------------------------------ */
function ListRow({
  kind,
  item,
  onSelect,
}: {
  kind: ListKind;
  item: ListItem;
  onSelect: (item: ListItem) => void;
}) {
  let leading: React.ReactNode;
  let trailing: string | undefined;

  if (kind === "country") {
    const c = item as Country;
    leading = <span aria-hidden>{c.flag}</span>;
    trailing = `${c.stateCount}`;
  } else if (kind === "state") {
    trailing = `${(item as State).cityCount}`;
  } else {
    const c = item as City;
    trailing = c.timezone ? c.timezone.split("/").pop()?.replace(/_/g, " ") : undefined;
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(item)}
        className="group flex min-h-[2.5rem] w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06]"
      >
        {leading && <span className="shrink-0 text-sm">{leading}</span>}
        <span className="min-w-0 flex-1 truncate font-display text-[0.82rem] text-ink/80 transition-colors group-hover:text-ink">
          {itemName(item)}
        </span>
        {trailing && (
          <span className="shrink-0 font-mono text-[0.62rem] text-ink/35 transition-colors group-hover:text-aurora">
            {trailing}
          </span>
        )}
        <Chevron dir="right" className="text-ink/20 transition-colors group-hover:text-aurora" small />
      </button>
    </li>
  );
}

function SkeletonRows() {
  return (
    <ul className="mt-2 space-y-0.5" aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i} className="flex items-center gap-2.5 px-2.5 py-2">
          <div className="h-3.5 flex-1 animate-pulse rounded bg-white/[0.07]" />
          <div className="h-3 w-6 animate-pulse rounded bg-white/[0.05]" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-24 flex-col items-center justify-center gap-1.5 px-4 py-8 text-center">
      <span aria-hidden className="text-lg opacity-40">
        ◍
      </span>
      <p className="font-display text-[0.78rem] text-ink/50">{message}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex h-full min-h-24 flex-col items-center justify-center gap-2.5 px-4 py-8 text-center"
    >
      <p className="font-display text-[0.78rem] text-city/90">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-[2.5rem] rounded-full border border-city/30 bg-city/10 px-4 py-1.5 font-display text-[0.72rem] tracking-wide text-city transition-colors hover:bg-city/20"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Icons                                                              */
/* ------------------------------------------------------------------ */
function Chevron({
  dir,
  className,
  small,
}: {
  dir: "left" | "right";
  className?: string;
  small?: boolean;
}) {
  const size = small ? 13 : 16;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      aria-hidden
      className={`shrink-0 ${className ?? ""}`}
    >
      <path
        d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MagnifierIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
