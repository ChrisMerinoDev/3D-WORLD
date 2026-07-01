import { describe, it, expect } from "vitest";
import { getTimeInfo, isValidTimeZone, InvalidTimezoneError } from "./time";

describe("getTimeInfo", () => {
  // Fixed instant: 2026-06-30T12:00:00Z (northern summer → DST active in NY).
  const instant = new Date("2026-06-30T12:00:00Z");

  it("computes offset, abbreviation and ISO for America/New_York (EDT)", () => {
    const info = getTimeInfo("America/New_York", instant);
    expect(info.timezone).toBe("America/New_York");
    expect(info.offsetMinutes).toBe(-240); // UTC-4 during EDT
    expect(info.abbreviation).toBe("EDT");
    // 12:00Z → 08:00 local, offset -04:00.
    expect(info.iso).toBe("2026-06-30T08:00:00-04:00");
  });

  it("handles UTC", () => {
    const info = getTimeInfo("UTC", instant);
    expect(info.offsetMinutes).toBe(0);
    expect(info.iso).toBe("2026-06-30T12:00:00+00:00");
  });

  it("handles half-hour offsets (Asia/Kolkata, +5:30)", () => {
    const info = getTimeInfo("Asia/Kolkata", instant);
    expect(info.offsetMinutes).toBe(330);
    expect(info.iso).toBe("2026-06-30T17:30:00+05:30");
  });

  it("trims surrounding whitespace", () => {
    expect(getTimeInfo("  UTC  ", instant).timezone).toBe("UTC");
  });

  it("throws InvalidTimezoneError for an invalid zone", () => {
    expect(() => getTimeInfo("Not/AZone", instant)).toThrow(InvalidTimezoneError);
    expect(() => getTimeInfo("", instant)).toThrow(InvalidTimezoneError);
    try {
      getTimeInfo("Mars/Phobos", instant);
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidTimezoneError);
      expect((err as InvalidTimezoneError).code).toBe("invalid_timezone");
    }
  });
});

describe("isValidTimeZone", () => {
  it("accepts real zones and rejects junk", () => {
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("America/Sao_Paulo")).toBe(true);
    expect(isValidTimeZone("Nope")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});
