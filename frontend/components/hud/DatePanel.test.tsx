import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { DatePanel } from "@/components/hud/DatePanel";
import { useWorldStore } from "@/store/worldStore";

const FIXED = new Date("2026-06-30T12:00:00Z");

describe("DatePanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED);
    useWorldStore.setState({ activeTimezone: "America/New_York" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders weekday, month, day and year for the seeded zone", () => {
    render(<DatePanel />);
    const panel = screen.getByTestId("date-panel");
    expect(panel).toHaveTextContent("Tuesday");
    expect(panel).toHaveTextContent("June");
    expect(panel).toHaveTextContent("30");
    expect(panel).toHaveTextContent("2026");
  });

  it("rolls to the next local day when the zone crosses midnight", () => {
    // 2026-06-30T23:30:00Z is still June 30 in Tokyo? Tokyo is +9 => Jul 1 08:30.
    vi.setSystemTime(new Date("2026-06-30T20:00:00Z")); // Tokyo: Jul 1, 05:00
    useWorldStore.setState({ activeTimezone: "Asia/Tokyo" });

    render(<DatePanel />);
    const panel = screen.getByTestId("date-panel");
    expect(panel).toHaveTextContent("July");
    expect(panel).toHaveTextContent("1");
    expect(panel).toHaveTextContent("2026");
  });

  it("updates when the active timezone changes", () => {
    render(<DatePanel />);
    const panel = screen.getByTestId("date-panel");
    expect(panel).toHaveTextContent("June");

    act(() => {
      // At 2026-06-30T12:00Z, Pacific/Kiritimati (+14) is already July 1.
      useWorldStore.setState({ activeTimezone: "Pacific/Kiritimati" });
    });

    expect(panel).toHaveTextContent("July");
  });
});
