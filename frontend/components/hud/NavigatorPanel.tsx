"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import { useWorldStore, type DrillLevel } from "@/store/worldStore";
import { LEVEL_ACCENT, LEVEL_LABEL } from "./levelAccent";

/**
 * Level-aware navigator. Lets users drill via the UI (not only the globe):
 * countries → states → cities → city detail. Every async section handles
 * loading (skeletons, no layout shift), error (with retry) and empty states.
 */
export function NavigatorPanel() {
  const level = useWorldStore((s) => s.level);
  const country = useWorldStore((s) => s.selectedCountry);
  const state = useWorldStore((s) => s.selectedState);
  const reduce = useReducedMotion();

  const accent = LEVEL_ACCENT[level];
  // A stable key per "view" so AnimatePresence cross-fades on drill changes.
  const viewKey =
    level === "world"
      ? "world"
      : level === "country"
        ? `country:${country?.iso2}`
        : level === "state"
          ? `state:${state?.iso}`
          : "city";

  return (
    <motion.aside
      aria-label="Location navigator"
      initial={reduce ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: "easeOut", delay: 0.18 }}
      className="glass pointer-events-auto absolute inset-x-3 bottom-3 flex max-h-[42vh] flex-col overflow-hidden rounded-2xl sm:inset-x-auto sm:bottom-6 sm:left-6 sm:max-h-[min(30rem,60vh)] sm:w-[21rem]"
    >
      <Header level={level} accent={accent} />
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={viewKey}
            initial={reduce ? false : { opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -10 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="aurora-scroll h-full overflow-y-auto px-3 pb-3"
          >
            <Body level={level} />
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                             */
/* ------------------------------------------------------------------ */
function Header({ level, accent }: { level: DrillLevel; accent: string }) {
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
  const loading = useWorldStore((s) => s.loading);

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
    meta = loading.cities ? "Loading cities…" : `${state.cityCount} cities`;
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
      <div className="min-w-0">
        <div className="font-display text-[0.55rem] uppercase tracking-[0.32em] text-ink/45">
          {LEVEL_LABEL[level]}
        </div>
        <div className="flex items-center gap-2 truncate font-display text-base font-medium text-ink">
          {flag && <span aria-hidden>{flag}</span>}
          <span className="truncate">{title}</span>
        </div>
        <div className="truncate font-mono text-[0.62rem] text-ink/45">{meta}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Body per level                                                     */
/* ------------------------------------------------------------------ */
function Body({ level }: { level: DrillLevel }) {
  if (level === "world") return <CountryList />;
  if (level === "country") return <StateList />;
  if (level === "state") return <CityList />;
  return <CityDetail />;
}

function CountryList() {
  const countries = useWorldStore((s) => s.countries);
  const loading = useWorldStore((s) => s.loading.countries);
  const error = useWorldStore((s) => s.error);
  const selectCountry = useWorldStore((s) => s.selectCountry);
  const loadCountries = useWorldStore((s) => s.loadCountries);

  if (loading && countries.length === 0) return <SkeletonRows />;
  if (error && countries.length === 0)
    return <ErrorState message={error} onRetry={() => void loadCountries()} />;
  if (countries.length === 0) return <EmptyState message="No countries available." />;

  return (
    <ul className="mt-2 space-y-0.5">
      {countries.map((c) => (
        <ListRow
          key={c.iso2}
          leading={<span aria-hidden>{c.flag}</span>}
          label={c.name}
          trailing={`${c.stateCount}`}
          onClick={() => void selectCountry(c.iso2)}
        />
      ))}
    </ul>
  );
}

function StateList() {
  const states = useWorldStore((s) => s.states);
  const loading = useWorldStore((s) => s.loading.states);
  const error = useWorldStore((s) => s.error);
  const country = useWorldStore((s) => s.selectedCountry);
  const selectState = useWorldStore((s) => s.selectState);
  const selectCountry = useWorldStore((s) => s.selectCountry);

  if (loading) return <SkeletonRows />;
  if (error)
    return (
      <ErrorState
        message={error}
        onRetry={country ? () => void selectCountry(country.iso2) : undefined}
      />
    );
  if (states.length === 0)
    return <EmptyState message="No subdivisions available for this country." />;

  return (
    <ul className="mt-2 space-y-0.5">
      {states.map((st) => (
        <ListRow
          key={st.iso}
          label={st.name}
          trailing={`${st.cityCount}`}
          onClick={() => void selectState(st.iso)}
        />
      ))}
    </ul>
  );
}

function CityList() {
  const cities = useWorldStore((s) => s.cities);
  const loading = useWorldStore((s) => s.loading.cities);
  const error = useWorldStore((s) => s.error);
  const state = useWorldStore((s) => s.selectedState);
  const selectState = useWorldStore((s) => s.selectState);
  const selectCity = useWorldStore((s) => s.selectCity);

  if (loading) return <SkeletonRows />;
  if (error)
    return (
      <ErrorState
        message={error}
        onRetry={state ? () => void selectState(state.iso) : undefined}
      />
    );
  if (cities.length === 0)
    return <EmptyState message="No cities available for this region." />;

  return (
    <ul className="mt-2 space-y-0.5">
      {cities.map((city) => (
        <ListRow
          key={`${city.name}:${city.lat},${city.lng}`}
          label={city.name}
          trailing={city.timezone ? city.timezone.split("/").pop()?.replace(/_/g, " ") : undefined}
          onClick={() => selectCity(city)}
        />
      ))}
    </ul>
  );
}

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
  leading,
  label,
  trailing,
  onClick,
}: {
  leading?: React.ReactNode;
  label: string;
  trailing?: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06]"
      >
        {leading && <span className="shrink-0 text-sm">{leading}</span>}
        <span className="min-w-0 flex-1 truncate font-display text-[0.82rem] text-ink/80 transition-colors group-hover:text-ink">
          {label}
        </span>
        {trailing && (
          <span className="shrink-0 font-mono text-[0.62rem] text-ink/35 transition-colors group-hover:text-aurora">
            {trailing}
          </span>
        )}
        <svg
          viewBox="0 0 24 24"
          width="13"
          height="13"
          fill="none"
          aria-hidden
          className="shrink-0 text-ink/20 transition-colors group-hover:text-aurora"
        >
          <path
            d="M9 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
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
          className="rounded-full border border-city/30 bg-city/10 px-3.5 py-1.5 font-display text-[0.72rem] tracking-wide text-city transition-colors hover:bg-city/20"
        >
          Try again
        </button>
      )}
    </div>
  );
}
