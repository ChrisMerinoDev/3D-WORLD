import { afterEach, expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";

// Register jest-dom matchers (toHaveTextContent, toBeInTheDocument, …) on the
// Vitest `expect`.
expect.extend(matchers);

// framer-motion's `useReducedMotion` reads `window.matchMedia`, which jsdom does
// not implement. Provide a minimal, non-reduced-motion stub.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// Ensure the DOM is torn down between component tests so each test is isolated.
afterEach(() => {
  cleanup();
});

