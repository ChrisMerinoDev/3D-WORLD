import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * Data-driven journeys through the HUD navigator (far more reliable than clicking
 * the WebGL/Cesium canvas). The navigator was reworked, so these cover the real
 * UX: a search box, a "Cities | Regions" segmented toggle at country level
 * (defaulting to Cities), and a collapse/reopen affordance.
 *
 * Japan is the fixture country because:
 *  - it has a single timezone (Asia/Tokyo, UTC+9, no DST) that differs from any
 *    likely CI/host zone, so the world clock's change is observable + stable, and
 *  - every Japanese city therefore inherits Asia/Tokyo, so drilling to any city
 *    keeps the clock on Tokyo deterministically.
 */

/** The navigator panel (its aria-label). */
const navOf = (page: Page): Locator => page.getByLabel("Location navigator");

/** Read the human label from a navigator list row button (first span = name). */
async function rowLabel(row: Locator): Promise<string> {
  const label = (await row.locator("span").first().textContent())?.trim();
  if (!label) throw new Error("navigator row has no label");
  return label;
}

/**
 * Select Japan at world level by clicking its country row. Waiting for the row to
 * appear doubles as the "countries have cold-loaded" gate (first API hit is slow).
 */
async function selectJapan(page: Page): Promise<void> {
  const nav = navOf(page);
  const japan = nav
    .locator("li button")
    .filter({ has: page.getByText("Japan", { exact: true }) });
  await expect(japan).toBeVisible({ timeout: 20_000 });
  await japan.click();
  await expect(page.getByTestId("breadcrumb")).toContainText("Japan");
}

test("Cities tab (default): lists Japan's cities capital-first and drilling a city sets the Tokyo clock", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "load" });
  const nav = navOf(page);
  const breadcrumb = page.getByTestId("breadcrumb");
  const clock = page.getByTestId("world-clock");

  await selectJapan(page);

  // Selecting the country already switches the clock to its primary zone.
  await expect(clock).toContainText("Tokyo");
  await expect(clock).toContainText("UTC+9");

  // At country level the "Cities" tab is active by default.
  await expect(nav.getByRole("tab", { name: "Cities" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // Country-wide cities load async (capital Tokyo is hoisted first).
  const cityRows = nav.locator("ul li button");
  await expect(cityRows.first()).toBeVisible({ timeout: 20_000 });
  await expect(cityRows.first()).toContainText("Tokyo");

  // Drill into the first city → city level; clock stays on Tokyo.
  const firstCity = cityRows.first();
  const cityName = await rowLabel(firstCity);
  await firstCity.click();
  await expect(breadcrumb).toContainText(cityName);
  await expect(clock).toContainText("Tokyo");
  await expect(clock).toContainText("UTC+9");
});

test("Regions tab: lists regions, drills region → city, then back-navigates the breadcrumb", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "load" });
  const nav = navOf(page);
  const breadcrumb = page.getByTestId("breadcrumb");
  const clock = page.getByTestId("world-clock");

  await selectJapan(page);

  // Switch to the Regions tab (states load on country selection).
  await nav.getByRole("tab", { name: "Regions" }).click();
  await expect(nav.getByRole("tab", { name: "Regions" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // Regions render. Pick the first region that actually has cities (trailing
  // count > 0) so the drill to a city is deterministic (avoids 0-city regions).
  const regionRows = nav.locator("ul li button");
  await expect(regionRows.first()).toBeVisible({ timeout: 20_000 });

  const total = await regionRows.count();
  let regionName = "";
  for (let i = 0; i < total; i++) {
    const row = regionRows.nth(i);
    const text = (await row.innerText()).trim();
    const trailing = text.match(/(\d+)\s*$/);
    if (trailing && Number(trailing[1]) > 0) {
      regionName = await rowLabel(row);
      await row.click();
      break;
    }
  }
  expect(regionName, "expected at least one Japan region with >0 cities").not.toBe("");
  await expect(breadcrumb).toContainText(regionName);

  // City list for that region loads → drill into the first city.
  const cityRows = nav.locator("ul li button");
  await expect(cityRows.first()).toBeVisible({ timeout: 20_000 });
  const cityName = await rowLabel(cityRows.first());
  await cityRows.first().click();
  await expect(breadcrumb).toContainText(cityName);
  // Every Japanese city sits in Asia/Tokyo.
  await expect(clock).toContainText("Tokyo");

  // ---- Back navigation via the breadcrumb Back control ----
  const back = breadcrumb.getByRole("button", { name: "Go back one level" });

  await back.click(); // city -> region
  await expect(breadcrumb).not.toContainText(cityName);
  await expect(breadcrumb).toContainText(regionName);

  await back.click(); // region -> country
  await expect(breadcrumb).not.toContainText(regionName);
  await expect(breadcrumb).toContainText("Japan");

  await back.click(); // country -> world
  await expect(breadcrumb).not.toContainText("Japan");
  await expect(back).toBeDisabled();
});

test("search filters the country list and submitting the sole match selects it", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "load" });
  const nav = navOf(page);
  const breadcrumb = page.getByTestId("breadcrumb");

  // Gate on countries being loaded (Japan row present).
  await expect(
    nav.locator("li button").filter({ has: page.getByText("Japan", { exact: true }) }),
  ).toBeVisible({ timeout: 20_000 });

  const search = nav.getByRole("searchbox");
  await search.fill("japan");

  // Only "Japan" survives the filter — assert it's the sole remaining row.
  const rows = nav.locator("ul li button");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Japan");

  // Submitting (Enter) with a single match selects it.
  await search.press("Enter");
  await expect(breadcrumb).toContainText("Japan");
});

test("collapse hides the navigator and the reopen handle restores it", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "load" });
  const nav = navOf(page);

  await expect(nav).toBeVisible({ timeout: 20_000 });

  // Collapse → the panel is removed and the "Explore" reopen handle appears.
  await nav.getByRole("button", { name: "Collapse location navigator" }).click();
  await expect(nav).toBeHidden();

  const reopen = page.getByRole("button", { name: "Open location navigator" });
  await expect(reopen).toBeVisible();

  // Reopen → the navigator panel comes back.
  await reopen.click();
  await expect(navOf(page)).toBeVisible();
});
