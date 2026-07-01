# Aurora — Integration Contract (read before building)

Agents build in parallel against these fixed seams. **Do not change a seam
without updating this file and the affected consumers.**

## Ownership (avoid editing files outside your area)

| Area                                   | Owner                     |
| -------------------------------------- | ------------------------- |
| `backend/src/**`                       | Backend engineer          |
| `frontend/app/api/**` (route handlers) | Backend engineer          |
| `frontend/components/globe/**`         | 3D / design engineer      |
| `frontend/app/(shell)`, `page.tsx`, `layout.tsx` | Frontend engineer |
| `frontend/components/hud/**`           | Frontend engineer         |
| `frontend/lib/**`, `frontend/store/**` | Frontend (already stubbed by orchestrator) |
| tests (`**/*.test.ts(x)`, `frontend/e2e/**`) | Testing engineer    |
| CI / vercel config / root ops          | DevOps engineer           |

## Fixed seams (already authored — import, do not rewrite)

- **Type contract:** `@aurora/backend/types` (`Country`, `State`, `City`, `TimeInfo`, `ApiError`).
- **API client:** `frontend/lib/api.ts` → `api.countries()`, `api.states(iso2)`, `api.cities(iso2, stateIso)`, `api.time(tz)`.
- **Store:** `frontend/store/worldStore.ts` → `useWorldStore`. State: `level`, `countries`, `states`, `cities`, `selectedCountry/State/City`, `activeTimezone`, `loading`, `error`. Actions: `loadCountries()`, `selectCountry(iso2)`, `selectState(iso)`, `selectCity(city)`, `goBack()`, `reset()`.

## API endpoints (backend implements as Next.js Route Handlers)

- `GET /api/countries` → `Country[]`
- `GET /api/countries/:iso2/states` → `State[]` (404 if unknown country)
- `GET /api/countries/:iso2/states/:stateIso/cities` → `City[]` (404 if unknown)
- `GET /api/time?tz=<IANA>` → `TimeInfo` (400 on invalid tz)

All GET responses set `Cache-Control: public, s-maxage=..., stale-while-revalidate=...`.
Errors use the `ApiError` envelope `{ error: { code, message } }`.

## Globe component seam (3D engineer implements)

- File: `frontend/components/globe/Globe.tsx`, default export `Globe` (a `"use client"` component, no required props).
- It **reads** selection + data from `useWorldStore` and **calls** `selectCountry`/`selectState`/`selectCity`/`goBack`.
- It calls `loadCountries()` on mount and renders country markers; on country select it flies to `selectedCountry` centroid and renders `states`; on state select renders `cities`.
- Must be safe to `next/dynamic` import with `{ ssr: false }`.
- Add `data-testid="globe-canvas"` on the canvas wrapper for E2E.

## HUD seam (frontend engineer implements)

- World clock (top-right) + date panel (below) read `activeTimezone` and tick live.
- Add test IDs: `data-testid="world-clock"`, `data-testid="date-panel"`, `data-testid="breadcrumb"`.

## Notes

- Next.js here is **v16** with breaking changes — consult `frontend/node_modules/next/dist/docs/` before using framework APIs.
- Strict TypeScript, no `any` at boundaries. Handle loading/error/empty everywhere.
