import { test, expect, type Locator } from "@playwright/test";

/**
 * Data-driven drill-down through the HUD navigator (more reliable than clicking
 * the WebGL canvas). Verifies the breadcrumb path and that the world clock
 * switches to the selected location's timezone, then walks back up.
 *
 * Japan is used because its primary timezone (Asia/Tokyo) differs from any
 * likely CI/host zone, so the clock's change is observable and deterministic.
 */

/** Read the human label from a navigator list row button. */
async function rowLabel(row: Locator): Promise<string> {
  const label = (await row.locator("span").first().textContent())?.trim();
  if (!label) throw new Error("navigator row has no label");
  return label;
}

test("drill country → state → city updates breadcrumb and clock, then back navigates", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "load" });

  const nav = page.getByLabel("Location navigator");
  const breadcrumb = page.getByTestId("breadcrumb");
  const clock = page.getByTestId("world-clock");

  // ---- Country: select Japan (loads via the globe mount effect, no WebGL needed)
  const japan = nav
    .locator("li button")
    .filter({ has: page.getByText("Japan", { exact: true }) });
  // First data-dependent wait — countries cold-load on the first API call.
  await expect(japan).toBeVisible({ timeout: 20_000 });
  await japan.click();

  await expect(breadcrumb).toContainText("Japan");
  // Clock switches to Japan's primary timezone (Asia/Tokyo → "Tokyo").
  await expect(clock).toContainText("Tokyo");
  await expect(clock).toContainText("UTC+9");

  // ---- State: Aichi Prefecture (known to contain cities)
  const aichi = nav
    .locator("li button")
    .filter({ has: page.getByText("Aichi Prefecture", { exact: true }) });
  await expect(aichi).toBeVisible();
  await aichi.click();
  await expect(breadcrumb).toContainText("Aichi Prefecture");

  // ---- City: first in the list
  const firstCity = nav.locator("ul li button").first();
  await expect(firstCity).toBeVisible();
  const cityName = await rowLabel(firstCity);
  await firstCity.click();
  await expect(breadcrumb).toContainText(cityName);
  // City sits in Asia/Tokyo — clock remains on Tokyo.
  await expect(clock).toContainText("Tokyo");

  // ---- Back navigation via the breadcrumb Back control ----
  const back = breadcrumb.getByRole("button", { name: "Go back one level" });

  await back.click(); // city -> state
  await expect(breadcrumb).not.toContainText(cityName);
  await expect(breadcrumb).toContainText("Aichi Prefecture");

  await back.click(); // state -> country
  await expect(breadcrumb).not.toContainText("Aichi Prefecture");
  await expect(breadcrumb).toContainText("Japan");

  await back.click(); // country -> world
  await expect(breadcrumb).not.toContainText("Japan");
  await expect(back).toBeDisabled();
});
