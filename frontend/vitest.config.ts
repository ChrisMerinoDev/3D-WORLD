import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Vitest config for the Aurora frontend.
 *
 * - jsdom environment for component/DOM tests
 * - `@` path alias mirrors tsconfig `paths` so imports match app code
 * - jest-dom matchers registered via the setup file
 * - E2E specs (Playwright, `e2e/**`) are excluded — they run under `playwright test`
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    restoreMocks: true,
  },
});
