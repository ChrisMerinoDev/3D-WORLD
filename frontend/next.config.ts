import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy tuned for a Next.js 16 App Router app that renders a
 * WebGL / Three.js globe.
 *
 * Notes on why each directive is what it is:
 * - `script-src` allows `'unsafe-inline'` because Next injects small inline
 *   bootstrap/hydration scripts and we are not (yet) wiring per-request nonces.
 *   `'unsafe-eval'` is only enabled in development where React Fast Refresh /
 *   the dev overlay require it; production stays free of eval.
 * - WebGL shader compilation happens in the GPU via the WebGL API, NOT via JS
 *   `eval`, so no eval permission is needed for Three.js in production.
 * - `blob:` + `data:` are allowed for images and workers so Three.js / R3F /
 *   drei can create object URLs, offscreen canvases, and (if later added) draco
 *   / ktx2 web workers without breaking.
 * - `worker-src blob:` covers web workers spawned from generated blob URLs.
 * - Fonts are self-hosted by `next/font/google` at build time, so `font-src`
 *   only needs `'self'` + `data:`.
 * - `connect-src 'self'` is enough today because the API is same-origin Route
 *   Handlers. Widen this if the backend is split to a separate origin.
 */
const scriptSrc = isProd
  ? "'self' 'unsafe-inline'"
  : "'self' 'unsafe-inline' 'unsafe-eval'";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "manifest-src 'self'",
].join("; ");

/**
 * Security headers applied to every route. We deliberately DO NOT set
 * `Cache-Control` here — the API Route Handlers manage their own caching
 * (`GEO_CACHE_CONTROL` / `no-store`) and must not be overridden.
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // HSTS only in production; sending it from localhost/dev can lock the host to
  // HTTPS during local testing.
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // The backend workspace ships TypeScript source consumed directly by
  // Next.js route handlers; transpile it as part of the app build.
  transpilePackages: ["@aurora/backend"],

  // Don't advertise the framework.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
