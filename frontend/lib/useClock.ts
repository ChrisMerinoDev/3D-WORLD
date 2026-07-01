"use client";

/**
 * Aurora shared clock.
 *
 * A SINGLE interval drives every time-dependent HUD element (world clock + date
 * panel). Components subscribe via `useSyncExternalStore`; the interval only
 * runs while there is at least one subscriber and is torn down when the last
 * one unmounts. This avoids per-component timers and keeps every readout in
 * lock-step.
 */
import { useMemo, useSyncExternalStore } from "react";
import { DateTime } from "luxon";

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let currentSecond = Math.floor(Date.now() / 1000);

function tick(): void {
  const second = Math.floor(Date.now() / 1000);
  if (second !== currentSecond) {
    currentSecond = second;
    for (const listener of listeners) listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === null) {
    // Poll faster than 1s so ticks land close to the true second boundary,
    // but only notify subscribers when the whole second actually changes.
    timer = setInterval(tick, 250);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getSnapshot = (): number => currentSecond;

/** Seconds-since-epoch, shared across all subscribers via one interval. */
export function useNowSecond(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export interface ZonedTime {
  /** HH:mm:ss in the target zone. */
  time: string;
  /** Full weekday name, e.g. "Tuesday". */
  weekday: string;
  /** Full month name, e.g. "June". */
  monthName: string;
  day: number;
  year: number;
  /** Short offset/abbreviation, e.g. "EDT" or "GMT-4". */
  abbreviation: string;
  /** Human offset label, e.g. "UTC-4". */
  offsetLabel: string;
  /** Readable location label derived from the IANA id, e.g. "New York". */
  zoneLabel: string;
  valid: boolean;
}

function zoneLabelFrom(zone: string): string {
  const segment = zone.split("/").pop() ?? zone;
  return segment.replace(/_/g, " ");
}

function offsetLabelFrom(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;
}

/**
 * Live, memoised time for an IANA zone. Recomputes once per second (via the
 * shared ticker) and immediately when `zone` changes.
 */
export function useZonedTime(zone: string): ZonedTime {
  const second = useNowSecond();
  return useMemo<ZonedTime>(() => {
    const dt = DateTime.now().setZone(zone);
    const valid = dt.isValid;
    return {
      time: valid ? dt.toFormat("HH:mm:ss") : "--:--:--",
      weekday: valid ? dt.toFormat("cccc") : "—",
      monthName: valid ? dt.toFormat("LLLL") : "—",
      day: valid ? dt.day : 0,
      year: valid ? dt.year : 0,
      abbreviation: valid ? dt.offsetNameShort ?? "" : "",
      offsetLabel: valid ? offsetLabelFrom(dt.offset) : "",
      zoneLabel: zoneLabelFrom(zone),
      valid,
    };
    // `second` is an intentional trigger: the body reads the live clock via
    // DateTime.now(), so we recompute each tick and whenever the zone changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone, second]);
}
