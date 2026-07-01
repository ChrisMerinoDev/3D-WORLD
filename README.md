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
