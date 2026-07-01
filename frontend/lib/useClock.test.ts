import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useZonedTime, useNowSecond } from "@/lib/useClock";

/**
 * A fixed instant: 2026-06-30T12:00:00Z (summer, so US zones are on DST).
 *   UTC              -> 12:00:00
 *   America/New_York -> 08:00:00 (EDT, UTC-4)
 *   Asia/Tokyo       -> 21:00:00 (JST, UTC+9)
 */
const FIXED = new Date("2026-06-30T12:00:00Z");

describe("useZonedTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the correct HH:MM:SS and date parts for a given IANA zone", () => {
    const { result } = renderHook(() => useZonedTime("America/New_York"));

    expect(result.current.time).toBe("08:00:00");
    expect(result.current.weekday).toBe("Tuesday");
    expect(result.current.monthName).toBe("June");
    expect(result.current.day).toBe(30);
    expect(result.current.year).toBe(2026);
    expect(result.current.offsetLabel).toBe("UTC-4");
    expect(result.current.zoneLabel).toBe("New York");
    expect(result.current.valid).toBe(true);
  });

  it("renders a different zone's wall-clock time at the same instant", () => {
    const { result: tokyo } = renderHook(() => useZonedTime("Asia/Tokyo"));
    expect(tokyo.current.time).toBe("21:00:00");
    expect(tokyo.current.offsetLabel).toBe("UTC+9");
    expect(tokyo.current.zoneLabel).toBe("Tokyo");

    const { result: utc } = renderHook(() => useZonedTime("UTC"));
    expect(utc.current.time).toBe("12:00:00");
    expect(utc.current.offsetLabel).toBe("UTC+0");
  });

  it("immediately changes output when the zone prop changes (no timer tick)", () => {
    const { result, rerender } = renderHook(({ zone }) => useZonedTime(zone), {
      initialProps: { zone: "America/New_York" },
    });
    expect(result.current.time).toBe("08:00:00");

    rerender({ zone: "Asia/Tokyo" });
    expect(result.current.time).toBe("21:00:00");
  });

  it("flags an invalid zone and renders placeholders", () => {
    const { result } = renderHook(() => useZonedTime("Not/AZone"));
    expect(result.current.valid).toBe(false);
    expect(result.current.time).toBe("--:--:--");
  });

  it("advances the readout when the shared ticker fires", () => {
    const { result } = renderHook(() => useZonedTime("UTC"));
    expect(result.current.time).toBe("12:00:00");

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.time).toBe("12:00:01");
  });
});

describe("useNowSecond", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("increments by one per elapsed second via the shared interval", () => {
    const { result } = renderHook(() => useNowSecond());
    // Let the shared interval sync to the mocked clock first (the module-level
    // seed is captured at import time under the real clock).
    act(() => {
      vi.advanceTimersByTime(250);
    });
    const start = result.current;

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current).toBe(start + 3);
  });
});
