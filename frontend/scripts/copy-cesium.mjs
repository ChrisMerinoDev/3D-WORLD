/**
 * Copies Cesium's runtime static assets (Workers, ThirdParty, Assets, Widgets)
 * into `public/cesium` so they can be served at `/cesium` (CESIUM_BASE_URL).
 *
 * Runs before `dev` and `build`. Idempotent: skips if already up to date.
 * Cesium may be hoisted to the workspace root, so we resolve it via require.
 */
import { createRequire } from "node:module";
import { cp, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const cesiumPkg = require.resolve("cesium/package.json");
const buildDir = join(dirname(cesiumPkg), "Build", "Cesium");
const outDir = join(process.cwd(), "public", "cesium");

const DIRS = ["Workers", "ThirdParty", "Assets", "Widgets"];
// The UMD entry (loaded via a <script> tag at runtime so Cesium is NOT bundled
// through Turbopack, which mangles Cesium's built code).
const FILES = ["Cesium.js"];

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  // Cheap up-to-date check: if the UMD entry is already copied, assume done.
  if (await exists(join(outDir, "Cesium.js"))) {
    console.log("[copy-cesium] assets already present, skipping");
    return;
  }
  await mkdir(outDir, { recursive: true });
  for (const d of DIRS) {
    const from = join(buildDir, d);
    if (!(await exists(from))) continue;
    await cp(from, join(outDir, d), { recursive: true });
  }
  for (const f of FILES) {
    const from = join(buildDir, f);
    if (!(await exists(from))) continue;
    await cp(from, join(outDir, f));
  }
  console.log(`[copy-cesium] copied ${[...DIRS, ...FILES].join(", ")} -> public/cesium`);
}

main().catch((err) => {
  console.error("[copy-cesium] failed:", err);
  process.exit(1);
});
