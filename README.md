# 🌍 Aurora — Real-Time 3D World Map

An interactive, real-time 3D globe. Click into the planet to drill down
**country → state/region → city**, with a live world clock and date panel
that update to the timezone of wherever you are exploring.

Built with a photoreal WebGL globe, cinematic fly-to camera choreography,
and a fast, cache-friendly geospatial data layer.

## Tech stack

| Layer     | Choice                                                                 |
| --------- | --------------------------------------------------------------------- |
| Frontend  | Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind v4    |
| 3D / anim | Three.js · React Three Fiber · drei · postprocessing · GSAP           |
| State     | Zustand (drill-down store)                                             |
| Time      | Luxon + `Intl` (IANA timezones)                                        |
| Backend   | Framework-agnostic TS data services (`country-state-city`, IANA zones) |
| API       | Next.js Route Handlers (single-deploy) with cache headers             |
| Tests     | Vitest (unit/component) · Playwright (E2E)                             |
| Deploy    | Vercel (Fluid Compute) · GitHub Actions CI                            |

## Monorepo layout

```
.
├── frontend/            # Next.js app: globe, HUD, state, API routes
├── backend/             # @aurora/backend — data + timezone services (shared)
│   └── src/types.ts     # SINGLE SOURCE OF TRUTH for the API contract
└── .claude/skills/      # Engineering role skills used by the build agents
```

## Getting started

```bash
npm install          # installs all workspaces
npm run dev          # start the frontend (http://localhost:3000)
npm run typecheck    # typecheck all workspaces
npm test             # unit tests
npm run test:e2e     # Playwright end-to-end
```

## Features

- 🌐 Real-time rotating Earth with day/night terminator and atmospheric glow
- 🖱️ Click-to-drill: country → states → cities, with cinematic fly-to
- 🕐 Live world clock (top-right) locked to the focused location's timezone
- 📅 Month / day / year panel synced to the same zone
- ⚡ Instanced markers, lazy-loaded 3D bundle, cached data responses
- ♿ Keyboard-navigable, respects `prefers-reduced-motion`

## Continuous integration

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request
to `main`, using the Node version pinned in `.nvmrc` with npm dependency caching:

- **`verify` job (fast gate):** `npm ci` → `npm run typecheck` → `npm run lint`
  → `npm test` (backend + frontend units) → `npm run build`.
- **`e2e` job (independent):** installs the Chromium browser
  (`playwright install --with-deps chromium`) and runs `npm run test:e2e`. It
  runs in parallel with the fast gate so it never blocks quick PR feedback, and
  uploads the Playwright HTML report as an artifact on failure.

Make both jobs required status checks on the `main` branch protection rule so
nothing merges without a green pipeline.

## Deployment (Vercel)

The deployable is the Next.js app in `frontend/`. It imports the
`@aurora/backend` workspace package directly (via `transpilePackages`), so the
install **must** run at the repository root where the lockfile and npm
workspaces live — otherwise `@aurora/backend` will not resolve.

### Vercel Project settings

Configure the project **once** (dashboard → Project → Settings). The committed
`frontend/vercel.json` already pins the install/build commands and framework; the
dashboard values below should match it.

| Setting                | Value                                             |
| ---------------------- | ------------------------------------------------- |
| Framework Preset       | **Next.js**                                       |
| Root Directory         | **`frontend`** (enable "Include files outside the Root Directory") |
| Install Command        | **`cd .. && npm ci`** (installs all workspaces at the repo root)   |
| Build Command          | **`next build`**                                  |
| Output Directory       | **`.next`** (Next.js default — leave as detected) |
| Node.js Version        | **22.x** (match `.nvmrc` / CI)                    |
| Compute                | **Fluid Compute (Node runtime)** — not Edge       |

> Config file location: `frontend/vercel.json` (the Vercel **Root Directory**).
> Vercel only reads `vercel.json` from the Root Directory, so a root-level file
> would be ignored once Root Directory is `frontend`. A plain `vercel.json` is
> used rather than a typed `vercel.ts` because the config is fully static (no
> runtime/env logic), so the extra tooling would add no value.

Route Handlers run on the Node.js runtime (Fluid Compute) by default — none are
declared `edge`, and `getCountries`/timezone lookups need Node APIs.

### Environment variables

| Variable                  | Scope       | Default | Notes                                  |
| ------------------------- | ----------- | ------- | -------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL`| all envs    | `/api`  | Relative default (single-deploy). Override only if the backend is split to its own origin (also widen the CSP `connect-src` if so). |

See `.env.example`. No secrets are required for the default single-deploy setup;
never commit real `.env*` files (`.gitignore` covers `.env*` and `.vercel`).

### Security headers

Set in `frontend/next.config.ts` via `headers()` (host-agnostic, works on and off
Vercel): `Content-Security-Policy`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`,
`Permissions-Policy`, and `Strict-Transport-Security` (production only). The CSP
is WebGL/Three.js-safe (`blob:`/`data:`/`worker-src blob:`) and does not set
`Cache-Control`, so the API Route Handlers keep their own cache policy.

**CSP tightening TODO (later):** `script-src` currently allows `'unsafe-inline'`
because Next.js emits inline bootstrap scripts. To harden, wire per-request
**nonces** via middleware and drop `'unsafe-inline'`. `connect-src` is `'self'`
today; widen it only if the API moves to a separate origin.

### Deploy flow & rollback

- Every push to a branch / PR → **Preview** deployment with its own URL.
- Merge/push to `main` → **Production** deployment (promoted from a green build).
- **Rollback:** Vercel → Project → **Deployments** → pick the last known-good
  production deployment → **Promote to Production** (instant, no rebuild). Or via
  CLI: `vercel rollback <deployment-url>`.
