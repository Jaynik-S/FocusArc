# FocusArc cleanup and performance audit

**Date:** 2026-10-30  
**Scope:** React/Vite frontend, FastAPI/PostgreSQL backend, Docker image, tests, and shipped assets.

## Baseline evidence

- Frontend production build: **265.41 kB JavaScript (85.23 kB gzip)**, **49.61 kB CSS (9.96 kB gzip)**, **95 modules**, **5.84 s** build time.
- Frontend `dist/`: **27 files / 23.7 MiB**. Most weight is required screensaver artwork; about **7.4 MiB** is confirmed legacy artwork.
- Backend: **184 tests passed** against disposable PostgreSQL 15 in Linux Python 3.11; deployment checks: **7 passed**.
- Frontend: **136/138 tests passed** in one parallel run. The two timeouts pass when isolated, identifying runner contention near Vitest's five-second limit rather than deterministic application failures.
- Static checks: TypeScript `--noUnusedLocals --noUnusedParameters` and `npm ls --depth=0` passed.
- Existing screensaver measurements: cold recolor **176–389 ms**, cache hit **0–0.1 ms**, environment animation about **27–28 fps** with average frame work under **1 ms**. The loop already stops while hidden/inactive/reduced-motion.

## Prioritized findings

| Priority | Finding | Evidence and impact | Targeted action |
| --- | --- | --- | --- |
| P0 | The one-second clock invalidates the whole timer runtime context. | `TimerRuntimeProvider` spreads `useStudySync()` into one context; `elapsedByTimer` is also rebuilt every tick. Static consumers and the route layout rerender even when only the clock changes. | Split stable runtime state from the live clock while retaining the current full hook for clock-dependent views. Memoize snapshot-derived collections. Add render-count regression coverage. |
| P0 | Timer and metadata mutations trigger redundant reconciliation reads. | Timer start/stop already performs a forced `/study-state` reconciliation, then `TimersPage` reloads again. Timer CRUD/adjustment dispatches a same-tab invalidation and explicitly requests sync, potentially queuing a second read. | Remove post-command reloads; separate cross-tab broadcast from same-tab refresh; patch start/stop response state immediately while the authoritative refresh remains in flight. Assert request counts and optimistic visibility in tests. |
| P0 | Summary repair scales with all finalized history. | `sessions._refresh_summaries()` loads every summary day and runs per-day select/upsert work after each completed-session adjustment. Latency grows with account history. | Restrict repair to dates touched by the changed interval and compute the date range with one bounded session query. Add correctness and bounded-query tests. |
| P1 | Common study-state and heartbeat paths read the active session twice. | `lock_current_state()`/`expire_locked()` load the active session, then callers load it again. The two-second poll and 30-second heartbeat pay the extra query. | Return/reuse the locked active session and cover query behavior without changing locking or API responses. |
| P1 | Production installs test-only Python packages. | `pytest`, `httpx`, and their transitive packages are project runtime dependencies and installed in the API image. Current image size is about **80 MB**. | Move test dependencies to an optional group and install a runtime-only lock in the Docker image. Verify with `pip check`, app import, Docker build, and integration tests. |
| P1 | Confirmed dead code and runtime assets remain. | Four legacy frontend modules have no production references; old wallpaper variants, an unused PNG favicon, and Bree Serif reference files are not loaded. `tsconfig.tsbuildinfo` is tracked despite being ignored. | Delete only reference-proven dead code/assets, remove their dead CSS/types, and keep asset/license notes outside Vite's public output where needed. |

## Preserve / do not optimize speculatively

- Keep all five active `master-screensaver*.png` files, random selection, HEX recoloring, prepared-image cache, randomized entrances, and environment animations.
- Keep the active `gouache-paper.webp` texture. It is the largest initial resource, but changing it without a visual quality comparison would be a risky cosmetic optimization.
- Keep `/schedule/week`, day summaries, cycle totals, migrations, authentication, and all existing database/API contracts.
- Do not cache every decoded screensaver source: each prepared image has large pixel/channel buffers, so a broad cache would trade a short preparation delay for excessive memory.
- Preserve the current UI and the **900×700** layout. Changes below are data-flow, request-count, query-count, packaging, and dead-code improvements.

## Expected measurable outcomes

- Static routes and layout stop rerendering on every timer second.
- Start/stop no longer performs the extra component-level reload, and the UI sees the command response before network reconciliation finishes.
- Same-tab CRUD/adjustment produces one requested reconciliation while other tabs still receive invalidation.
- Summary adjustment query work remains bounded as unrelated historical summary days increase.
- Production assets shrink by roughly **7.6 MiB** without touching active artwork; the API image omits test-only packages.

