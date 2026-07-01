import { test, expect, type ConsoleMessage } from "@playwright/test";

/**
 * Load smoke test: the shell mounts, the four key HUD/globe regions are visible,
 * and the page loads without uncaught exceptions or console errors.
 */
test("app loads with globe, clock, date and breadcrumb — no page errors", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  await page.goto("/", { waitUntil: "load" });

  await expect(page.getByTestId("globe-canvas")).toBeVisible();
  await expect(page.getByTestId("world-clock")).toBeVisible();
  await expect(page.getByTestId("date-panel")).toBeVisible();
  await expect(page.getByTestId("breadcrumb")).toBeVisible();

  // The clock should show a real time readout (HH:MM) once mounted.
  const clock = page.getByTestId("world-clock");
  await expect(clock).toContainText(/\d{2}:\d{2}/);

  // The clock is live: its readout (seconds included) must change within a few
  // seconds. Polling (rather than a fixed sleep) keeps this fast and non-flaky.
  const firstReadout = (await clock.innerText()).trim();
  await expect(async () => {
    expect((await clock.innerText()).trim()).not.toBe(firstReadout);
  }).toPass({ timeout: 5_000 });

  // Give any late async work (data fetch, Cesium/WebGL init, tile fetches) a beat
  // to surface errors.
  await page.waitForTimeout(1500);

  // No uncaught JS exceptions — the app must never throw, even if the globe's
  // WebGL init fails (the Globe catches that and shows a static fallback).
  expect(pageErrors, `page errors:\n${pageErrors.join("\n")}`).toEqual([]);

  // Console errors: allow known-benign graphics/globe noise, FAIL on app errors.
  //
  // Headless chromium renders WebGL via SwiftShader and CesiumJS pulls satellite
  // imagery/terrain from Cesium ion. In a headless/CI context these legitimately
  // emit noise we must not fail on:
  //   - WebGL / SwiftShader / GPU context warnings,
  //   - CesiumJS-originated messages,
  //   - failed ion / tile / imagery / terrain resource fetches (network-gated).
  // Anything else (React errors, our own thrown errors, 500s from our API) is a
  // real failure and is kept.
  const BENIGN =
    /webgl|swiftshader|gpu|cesium|\bion\b|assets\.ion|imagery|terrain|quantized|\btile(s)?\b|Failed to load resource.*(cesium|ion|tile|terrain|imagery)/i;
  const meaningful = consoleErrors.filter((t) => !BENIGN.test(t));
  expect(meaningful, `console errors:\n${meaningful.join("\n")}`).toEqual([]);
});
