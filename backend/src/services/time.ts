/**
 * Timezone service: authoritative current time for an IANA zone.
 *
 * Uses only the platform `Intl` APIs (ICU) — no timezone database dependency.
 * The server returns the authoritative offset/abbreviation/ISO instant; the
 * client is expected to tick locally between refreshes.
 */
import type { TimeInfo } from "../types.js";

/** Thrown when a caller passes a string that is not a valid IANA timezone. */
export class InvalidTimezoneError extends Error {
  /** Stable machine-readable code for the API error envelope. */
  readonly code = "invalid_timezone";
  constructor(public readonly timezone: string) {
    super(`Invalid IANA timezone: ${JSON.stringify(timezone)}`);
    this.name = "InvalidTimezoneError";
  }
}

/** True if `tz` is a timezone the runtime's Intl/ICU accepts. */
export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function partsToRecord(parts: Intl.DateTimeFormatPart[]): Map<Intl.DateTimeFormatPartTypes, string> {
  const map = new Map<Intl.DateTimeFormatPartTypes, string>();
  for (const p of parts) map.set(p.type, p.value);
  return map;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Compute authoritative time info for `timezone` at instant `now`.
 *
 * @param timezone IANA identifier, e.g. "America/New_York".
 * @param now      Instant to evaluate (defaults to current time; injectable for tests).
 * @throws {InvalidTimezoneError} when `timezone` is missing or not a valid IANA zone.
 */
export function getTimeInfo(timezone: string, now: Date = new Date()): TimeInfo {
  const tz = typeof timezone === "string" ? timezone.trim() : "";
  if (!isValidTimeZone(tz)) {
    throw new InvalidTimezoneError(timezone);
  }

  const wallFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const wall = partsToRecord(wallFormatter.formatToParts(now));
  const year = Number(wall.get("year"));
  const month = Number(wall.get("month"));
  const day = Number(wall.get("day"));
  const hour = Number(wall.get("hour"));
  const minute = Number(wall.get("minute"));
  const second = Number(wall.get("second"));

  // Offset = (local wall clock interpreted as UTC) - (actual UTC instant).
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMinutes = Math.round((wallAsUtc - now.getTime()) / 60000);

  // Short zone abbreviation, e.g. "EDT" / "GMT+5:30" depending on the zone.
  const abbrParts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "short",
    hour: "2-digit",
  }).formatToParts(now);
  const abbreviation = abbrParts.find((p) => p.type === "timeZoneName")?.value ?? "UTC";

  // ISO 8601 wall time with explicit offset designator.
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetMinutes);
  const offset = `${sign}${pad2(Math.floor(absOffset / 60))}:${pad2(absOffset % 60)}`;
  const iso = `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}${offset}`;

  return {
    timezone: tz,
    iso,
    offsetMinutes,
    abbreviation,
  };
}
