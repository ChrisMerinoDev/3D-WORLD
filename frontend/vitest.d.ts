/**
 * Augments Vitest's `expect` with the jest-dom matcher types (toHaveTextContent,
 * toBeInTheDocument, …) so `tsc --noEmit` accepts them. The matchers are
 * registered at runtime in vitest.setup.ts via `expect.extend`.
 */
/* eslint-disable @typescript-eslint/no-empty-object-type -- interface extension is the required augmentation shape */
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";
import "vitest";

declare module "vitest" {
  interface Assertion<T = unknown> extends TestingLibraryMatchers<unknown, T> {}
  interface AsymmetricMatchersContaining
    extends TestingLibraryMatchers<unknown, unknown> {}
}
