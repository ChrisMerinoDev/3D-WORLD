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
  await expect(page.getByTestId("world-clock")).toContainText(/\d{2}:\d{2}/);

  // Give any late async work (data fetch, WebGL init) a beat to surface errors.
  await page.waitForTimeout(1500);

  // No uncaught JS exceptions.
  expect(pageErrors, `page errors:\n${pageErrors.join("\n")}`).toEqual([]);

  // No console errors (ignore benign WebGL/context noise from headless GPU).
  const meaningful = consoleErrors.filter(
    (t) => !/webgl|swiftshader|three\.js|GPU stall|Failed to create WebGL/i.test(t),
  );
  expect(meaningful, `console errors:\n${meaningful.join("\n")}`).toEqual([]);
});
