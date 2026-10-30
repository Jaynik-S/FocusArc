# FocusArc Cleanup and Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove verified dead weight and make timer commands, cross-view state, backend reads, and production packaging measurably leaner without changing FocusArc's UI, APIs, database schema, or active features.

**Architecture:** Preserve the existing React runtime provider and FastAPI service layers. Add one stable React context beside the existing live context, distinguish local reconciliation from cross-tab notification, reuse already-loaded database state, and bound summary repair to affected dates. Keep the five-screenaver renderer and animation architecture intact.

**Tech Stack:** React 18, TypeScript, Vite/Vitest, FastAPI, SQLAlchemy 2, PostgreSQL 15, pytest, Docker/Python 3.11.

**Spec:** `deep-dive/focusarc-codebase-2026-10-30.md`

---

## Task 1: Lock in frontend interaction and rerender regressions

**Files:**
- Modify: `frontend/tests/study-sync.test.tsx`
- Modify: `frontend/tests/adjustments.test.tsx`
- Modify: `frontend/tests/ui-redesign.test.tsx`

- [x] Add a test with one live-clock consumer and one stable-state consumer under `TimerRuntimeProvider`; advance the one-second clock and prove only the live consumer rerenders.
- [x] Add a deferred-reconciliation test: resolve a start/stop command response while `/study-state` remains pending, and assert the matching active state is visible immediately while `busy` remains true.
- [x] Add request-count assertions proving timer start/stop performs one command plus one reconciliation, with no component-level reload.
- [x] Add same-tab/cross-tab invalidation coverage proving one local mutation requests one reconciliation and still posts a broadcast for other tabs.
- [x] Run the focused tests and confirm the new assertions fail for the intended reasons.
- [x] Keep the regression coverage adjacent to the minimal implementation commit.

## Task 2: Reduce frontend tick rerenders and duplicate requests

**Files:**
- Modify: `frontend/src/hooks/useStudySync.ts`
- Modify: `frontend/src/context/TimerRuntimeContext.tsx`
- Modify: `frontend/src/api/dataEvents.ts`
- Modify: `frontend/src/hooks/useTimers.ts`
- Modify: `frontend/src/api/sessionAdjustments.ts`
- Modify: `frontend/src/routes/MainLayout.tsx`
- Modify: `frontend/src/routes/TimersPage.tsx`
- Modify: `frontend/src/routes/StatsPage.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/components/StudyReady.tsx`
- Modify: `frontend/src/components/TimerSelection.tsx`
- Modify: `frontend/src/components/EndDayButton.tsx`
- Modify: `frontend/src/components/stats/StatsOverview.tsx`
- Modify: `frontend/src/components/Screensaver.tsx`

- [x] Memoize `snapshotTimers` and `elapsedByTimer` by snapshot rather than rebuilding them on every clock tick.
- [x] Add `useTimerRuntimeState()` backed by a stable context that excludes `nowMs`/`elapsedSeconds`; retain `useTimerRuntime()` for clock-dependent consumers and compatibility.
- [x] Move non-clock consumers to the stable hook. Keep live clock use only in timer display, Sidebar, History/Schedule allocation, and Screensaver.
- [x] Let `Screensaver` consume its own live elapsed value so `MainLayout` no longer rerenders the route tree each second.
- [x] Extend `mutate()` with a response-to-snapshot patch callback. Patch start and stop state as soon as the command response arrives, but keep `busy` true until authoritative reconciliation completes.
- [x] Remove redundant `reload()` calls after start/stop/reset handlers.
- [x] Label local mutation events so readers refresh once while the local coordinator explicitly reconciles once; continue broadcasting to other tabs.
- [x] Run focused sync, adjustment, UI, and screensaver tests plus TypeScript checks.
- [ ] Commit as `perf(frontend): reduce timer rerenders and sync requests`.

## Task 3: Remove verified frontend dead code and shipped legacy assets

**Files:**
- Delete: `frontend/src/components/TimerCard.tsx`
- Delete: `frontend/src/components/TopBar.tsx`
- Delete: `frontend/src/components/WeekAccordion.tsx`
- Delete: `frontend/src/hooks/useScheduleWeek.ts`
- Delete: `frontend/src/hooks/useActiveSession.ts`
- Modify: `frontend/tests/release.test.tsx`
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/styles.css`
- Delete: `frontend/public/screensaver/space-blue.png`
- Delete: `frontend/public/screensaver/space-purple.png`
- Delete: `frontend/public/screensaver/space-orange.png`
- Delete: `frontend/public/favicon.png`
- Delete: `frontend/public/fonts/bree-serif-latin.woff2`
- Delete: `frontend/public/fonts/breeserif-OFL.txt`
- Delete: `frontend/public/fonts/breeserif-FONTLOG.txt`
- Delete: `frontend/tsconfig.tsbuildinfo`
- Modify: `frontend/public/fonts/README.md`
- Modify: `frontend/public/screensaver/README.md`
- Modify: `docs/cross-device-sync.md`
- Modify: `docs/timer-adjustments.md`

- [ ] Re-run repository-wide reference searches for every candidate and preserve anything dynamically referenced.
- [ ] Point release coverage directly at `useStudySync`, then remove the one-line `useActiveSession` compatibility wrapper.
- [ ] Remove the four unreferenced legacy UI modules, their supporting types, and only the CSS selectors exclusive to them.
- [ ] Remove the three explicitly legacy wallpapers, unused PNG favicon, and unused Bree Serif files; update asset notes without changing active master artwork or its license trail.
- [ ] Stop tracking the generated TypeScript build-info artifact (it is already ignored).
- [ ] Build and compare `dist` file count/bytes with the baseline 27 files / 23.7 MiB.
- [ ] Commit as `chore(frontend): remove legacy code and assets`.

## Task 4: Bound backend state and summary database work

**Files:**
- Modify: `backend/tests/test_study_sync.py`
- Modify: `backend/tests/test_session_adjustments.py`
- Modify: `backend/app/services/study_state.py`
- Modify: `backend/app/services/sessions.py`
- Modify: `backend/app/services/stats.py`

- [ ] Add a query/call-count regression proving unchanged study-state and heartbeat paths do not fetch the active session twice.
- [ ] Add adjustment coverage with many unrelated finalized summary days; assert touched-day totals remain correct and SQL work stays bounded.
- [ ] Make the lock/expiry helper return the active session it already loaded and reuse it in snapshot, heartbeat, and command preparation paths.
- [ ] Expose a range-total helper in `stats.py` and replace all-history summary repair with one bounded query over dates touched by the session's previous/new interval.
- [ ] Preserve zero-total cached rows, timezone allocation behavior, revision semantics, row locking, and public responses.
- [ ] Run focused backend tests against disposable PostgreSQL 15, then the full backend suite.
- [ ] Commit as `perf(backend): bound study state and summary queries`.

## Task 5: Slim the production backend image

**Files:**
- Modify: `backend/pyproject.toml`
- Create: `backend/requirements-runtime.lock`
- Modify: `backend/Dockerfile`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`
- Modify: `docs/deployment.md`

- [ ] Move `pytest` and `httpx` from runtime dependencies to a `test` optional dependency group while retaining the fully pinned test lock for CI.
- [ ] Create a pinned runtime lock containing only application/transitive runtime packages; retain Alembic because migrations run separately using the same image.
- [ ] Install the runtime lock in the production Dockerfile and keep `pip install --no-deps .`.
- [ ] Update CI/local test commands to install the test lock explicitly; do not change migration/startup separation.
- [ ] Build the image, run `pip check`, import the FastAPI app, run health/release checks, and compare image size to the ~80 MB baseline.
- [ ] Commit as `build(backend): exclude test packages from runtime image`.

## Task 6: Full verification and before/after comparison

**Files:**
- Modify: `deep-dive/focusarc-codebase-2026-10-30.md`
- Modify: `docs/deployment.md` only if commands/results changed

- [ ] Run frontend type checks, production build, and the full test suite. If the parallel-only baseline timeout recurs, verify each affected file and run the suite with bounded workers; document rather than hide it with a broad timeout.
- [ ] Run all backend tests in Linux Python 3.11 against the disposable PostgreSQL 15 database and run deployment tests.
- [ ] Run Alembic upgrade from an empty disposable database and verify the current revision.
- [ ] At 900×700, exercise authentication, timer start/pause/switch/adjust, screensaver readiness and all five selections, History, Schedule, and Stats without visual redesign.
- [ ] Record final frontend bundle/public bytes, Docker image bytes, request counts, rerender behavior, query bounds, and screensaver measurements in the audit.
- [ ] Inspect `git diff`, ensure root `master-screensaver*.png` source files and all credentials/backups remain untracked, and verify each logical commit contains only intended files.
- [ ] Commit final evidence/doc updates as `docs: record cleanup verification results`.

