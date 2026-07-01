import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { WorldClock } from "@/components/hud/WorldClock";
import { useWorldStore } from "@/store/worldStore";

const FIXED = new Date("2026-06-30T12:00:00Z"); // 08:00:00 EDT / 21:00:00 JST

describe("WorldClock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED);
    useWorldStore.setState({ activeTimezone: "America/New_York" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the seeded timezone's time after hydration/mount", () => {
    render(<WorldClock />);
    const clock = screen.getByTestId("world-clock");
    // After mount, useMounted flips true and the real readout shows.
    expect(clock).toHaveTextContent("08:00");
    expect(clock).toHaveTextContent(":00");
    expect(clock).toHaveTextContent("New York");
    expect(clock).toHaveTextContent("UTC-4");
  });

  it("updates immediately when activeTimezone changes in the store", () => {
    render(<WorldClock />);
    const clock = screen.getByTestId("world-clock");
    expect(clock).toHaveTextContent("08:00");

    act(() => {
      useWorldStore.setState({ activeTimezone: "Asia/Tokyo" });
    });

    expect(clock).toHaveTextContent("21:00");
    expect(clock).toHaveTextContent("Tokyo");
    expect(clock).toHaveTextContent("UTC+9");
  });

  it("ticks forward on the shared timer", () => {
    render(<WorldClock />);
    const clock = screen.getByTestId("world-clock");
    expect(clock).toHaveTextContent("08:00");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    // One minute later: 08:01 in New York.
    expect(clock).toHaveTextContent("08:01");
  });
});
