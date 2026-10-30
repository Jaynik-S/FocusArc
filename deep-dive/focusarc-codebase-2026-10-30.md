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

## Implemented changes

- Split stable timer runtime state from the one-second live clock. Static consumers no longer rerender for clock-only changes, while live timer and screensaver displays retain their existing updates.
- Applied start/stop command responses immediately, retained `busy` through authoritative reconciliation, and removed component-level reloads that duplicated study-state reads.
- Kept same-tab readers and cross-tab listeners distinct: one local mutation requests one reconciliation and still broadcasts invalidation to other tabs.
- Removed reference-proven dead React modules, hooks, types, selectors, legacy wallpapers, an unused favicon, unused Bree Serif files, and public build metadata. All five active master wallpapers remain unchanged.
- Reused the active session already loaded under the study-state lock and limited summary repair to days touched by the changed session interval.
- Split test-only Python packages out of the production dependency lock and Docker image without changing migration or startup separation.
- Corrected the animation verifier to compare scene/palette synchronization only after a decoded wallpaper frame is ready. Loading canvases are hidden and are not user-visible frames.

## Final before/after measurements

### Frontend output and runtime work

| Measurement | Baseline | Final | Result |
| --- | ---: | ---: | --- |
| JavaScript | 265.41 kB / 85.23 kB gzip | 266.31 kB / 85.54 kB gzip | +0.90 kB / +0.31 kB gzip for the stable runtime context and immediate command patching |
| CSS | 49.61 kB / 9.96 kB gzip | 48.32 kB / 9.80 kB gzip | -1.29 kB / -0.16 kB gzip |
| Built files | 27 | 15 | 12 fewer shipped files |
| `dist/` bytes | 24,849,238 | 17,215,793 | **7,633,445 bytes (30.7%) smaller** |
| Static consumer renders on a one-second tick | 1 | 0 | Clock-only updates remain in live consumers |
| Start/stop data flow | command + reconciliation + component reload | command + one reconciliation | Immediate response state; no duplicate component reload |
| Local mutation synchronization | local event plus potentially queued coordinator refresh | one local reconciliation plus cross-tab broadcast | No duplicate same-tab study-state request |

The slight JavaScript increase is the deliberate stable-context boundary and response patch logic. It removes route-tree work every second and redundant network work, which is more valuable than the sub-kilobyte gzip change.

### Backend and production image

| Measurement | Baseline | Final | Result |
| --- | ---: | ---: | --- |
| Active-session lookups per unchanged snapshot/heartbeat | 2 | 1 | Reuses the row loaded under lock |
| Adjustment SQL with 40 unrelated summary days | 57 statements | at most 20 | Work remains bounded by touched dates |
| API image | 79,965,100 bytes | 75,546,979 bytes | **4,418,121 bytes (5.5%) smaller** |
| Backend tests | 184 passed | 186 passed | Added query-bound and persistence coverage |

The optimized image passes `pip check`, imports the FastAPI application, serves `/api/health`, and excludes `pytest` and `httpx`. Alembic remains available because production migrations use the image in a separate release step.

### Screensaver and animation measurements

- Five wallpapers across four representative colors: **20/20 renders passed**, with distinct output hashes, source+HEX cache hits, and protected cream details preserved.
- Focused recolor repeat: cold **176-343 ms**, normalized cache **0-0.2 ms**, maximum main-thread heartbeat gap **43 ms**, and one idle worker termination after buffer expiry. A single 92 ms sample during the preceding heavy sweep was not reproduced; the repeat matches the 46 ms baseline.
- All five environments at 900×700: **29.1-29.7 fps**, average draw **0.31-0.90 ms**, p95 draw **0.6-1.6 ms**.
- Every scene verified motion, palette/artwork synchronization, no static recolor work inside animation loops, and complete stopping while exited, hidden, or under reduced-motion preference.
- Resume chooses a new randomized scene, and switching timers replaces the prior animation buffer.

The worker-based recolor and animation implementations were already efficient and were intentionally preserved. The cleanup concentrates on preventing unrelated React and request work from competing with them.

## Final verification evidence

- Frontend strict TypeScript (`--noUnusedLocals --noUnusedParameters`): passed.
- Frontend Vitest: **26 files / 142 tests passed**.
- Frontend production build: passed, **95 modules**, Vite build **2.15 s** on the final run.
- Backend in Linux Python 3.11 with disposable PostgreSQL 15: **186 passed**; only two known upstream deprecation warnings.
- Explicit release/deployment subset: **22 passed**.
- Empty disposable database: migrations applied `0001` through `0005_study_sync`; a second `upgrade head` was a no-op; `current`, `heads`, and read-only schema assertions all confirmed `0005_study_sync`.
- Isolated browser sweep at 900×700: authentication, timer play/pause, adjustment, screensaver readiness/exit, History, Schedule, Stats, error/empty states, both themes, and responsive variants passed with **30 captured states and zero page errors**.
- Representative 900×700 timer, Stats, and screensaver captures were inspected visually; the existing composition, controls, content, and responsive layout remain intact.

All destructive backend tests used only the guarded `focusarc_test` role/database in the disposable tmpfs PostgreSQL container. Migration verification used a separate disposable `focusarc_migration_check` database. Personal volumes, backups, credentials, and browser-state exports were not read or modified.

## Logical commits

- `3412d8a` - audit and prioritized implementation plan
- `7d1176c` - frontend rerender/request reduction
- `1bdc923` - dead code and legacy asset removal
- `7d6fe55` - bounded backend state/summary queries
- `c59cdf1` - runtime-only backend image dependencies
- `1a1b15c` - ready-frame animation verification correction

