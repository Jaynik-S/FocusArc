# Cross-device study synchronization implementation plan

> **For agentic workers:** Execute this plan task-by-task using the executing-plans skill after the design and policy decisions are approved. Write regression tests first and preserve the existing timer/session architecture.

**Goal:** The same account on a laptop and desktop sees the same persisted History, Schedule, course counters, active session, and running elapsed time, including after sleep, refresh, reconnect, or concurrent actions.

**Architecture:** Keep PostgreSQL authoritative. Add one versioned account snapshot, one frontend synchronization coordinator, and a server-calibrated clock. Reuse existing session intervals, account row locks, resource hooks, and invalidation events.

**Tech stack:** Existing FastAPI, SQLAlchemy/PostgreSQL, React, TypeScript, Vitest, pytest, and Playwright tooling. No additional infrastructure or dependency is proposed for the initial implementation.

**Spec:** The requirements, decisions, interfaces, and acceptance matrix below are the design specification for this plan.

**Status:** Implemented and locally verified on `feat/cross-device-study-sync`. See `docs/cross-device-sync.md` for final contracts, file responsibilities, validation and rollout notes. Investigated local `main` at `0a86867`, which contains merged PR #4. Production configuration and an actual laptop/desktop pair have not been inspected or tested in this investigation.

## Requirements and decisions

- Persist one active study session per account; both devices observe its same ID, course, adjusted UTC start, and running/paused state.
- An edit from either History or Schedule changes the shared session and refreshes the other device's open views without navigation or manual reload.
- Apply active-session state and completed counters together so a stop cannot briefly double-count or drop time.
- Derive elapsed time from a shared server timeline, with tick boundaries aligned to server seconds. Device wall-clock changes must not alter recorded study time.
- Use one account time zone for calendar dates and all default study views. Approved account zone: `America/Toronto`; retain historical session time zones and timestamps.
- Preserve +10/−5 start-only adjustments, zero clamping, fixed completed ends, archived-course reporting, and interval-based midnight/DST allocation.
- Target visible-device change propagation within one two-second polling interval plus a successful request's latency. Target displayed timer agreement within one second under healthy network/browser scheduling. Exact simultaneous pixels across suspended or disconnected devices cannot be guaranteed; show stale/offline state instead of claiming a live match.
- On login, focus the active course instead of a stale device-local selection. On a remote active-course switch, follow the shared active course, preserving any open form contents.

Approved policy decisions (2026-10-25):

1. **Counter meaning:** Show today's study total in America/Toronto on the dial and sidebar. Keep cycle counters for the explicitly labeled reset action; resetting a cycle does not erase today's records.
2. **Sleep behavior:** Keep automatic inactivity stopping. Use a persisted account-wide server lease renewed every 30 seconds by any awake signed-in browser. Expire after five minutes with no heartbeat, stop at the last heartbeat to exclude suspended time, and clamp duration at zero. A sleeping observer must never stop another active device. Expire before accepting a late renewal. A 15-second server sweep and request-time expiry handle all-clients-closed and server restarts.

Implementation authorized by the user's Continue. Progress is tracked in the plan-scoped SDD ledger.

## Findings from the current code

| Finding | Evidence and consequence |
| --- | --- |
| Account data is already shared in PostgreSQL | `backend/app/models/session.py` scopes sessions by username and enforces one active session per user. `services/sessions.py:26` serializes study writes with an account row lock. Independent signed login cookies can access the same account data. |
| Current change notifications are local | `frontend/src/api/dataEvents.ts:5` uses BroadcastChannel plus a window event. This reaches other browser contexts locally, not another computer. |
| Polling covers only part of the state | `hooks/useActiveSession.ts:175–188` polls `/active-session` every 15 seconds while visible, backing off to 120 seconds. It does not refresh completed counters or emit a History/Schedule invalidation when a remote edit is discovered. |
| Counters can remain stale indefinitely | `context/TimerRuntimeContext.tsx:106–123` refreshes counters on mount and local study-data events. A remote stop can clear the active session through polling while leaving the displayed completed counter behind. |
| Browser clocks affect the live timer and saved stop | `hooks/useActiveSession.ts:149,266,318` subtracts the saved start from `Date.now()`. `/stop` submits a client timestamp; `services/sessions.py:198–203` accepts an earlier client clock. A slow clock can undercount even though the database is shared. |
| A sleeping observer can stop another device's work | `hooks/useActiveSession.ts:320–324` posts a stop at its local saved last-active time after five minutes. `/stop` has no expected session ID, so a stale device can stop the account's newer active session. `frontend/tests/release.test.tsx:108` explicitly tests the existing inactivity-stop behavior. |
| Legacy offsets still differ by browser | `TimerRuntimeContext.tsx:100–104,220` reads browser offsets and pending adjustments; stop/switch/reset can still apply them. They are not shared account state. |
| Selected course and calendar defaults differ locally | `TimerSelectionContext.tsx:32–50` stores selection locally; `TimersPage.tsx:36` only selects the active timer if no selection exists. History, Schedule, and Stats use the device's time zone and clock for defaults. |
| Active blocks do not have a shared ticking clock | `components/DayTimeline.tsx:49` uses `new Date()` during render. With no relevant render, the active block does not continuously advance. |
| Atomicity exists for adjustments, but other commands can be stale | `AdjustSessionRequest` has expected start/end fields. Start, generic stop, and reset have no shared account revision or expected active-session guard. Serialization alone cannot tell whether a command came from obsolete UI. |
| Earlier browser verification covered tabs, not independent devices | Existing frontend tests and the previous two-tab browser check do not prove cross-device invalidation, clock-skew tolerance, or observer sleep safety. |

Investigation check run: `npm.cmd test -- tests/release.test.tsx --reporter=dot` — **6 tests passed**, including the current polling/backoff and inactivity-stop behavior. These are characterization results, not evidence that cross-device sync already works.

## Approach comparison

| Option | Result | Decision |
| --- | --- | --- |
| Refresh all views with the current 15-second poll | Reduces stale views but leaves clock skew, unsafe inactivity stops, mixed snapshots, and slow propagation | Insufficient for the requested behavior |
| **Versioned account snapshot every two seconds, plus server-calibrated ticks** | Bounded propagation, coherent counters/session state, cross-device recovery, no streaming infrastructure | **Recommended initial implementation** |
| Server-sent events or WebSockets with the same snapshots and clock | Lower notification latency, but adds reconnect/authentication/worker fan-out and deployment concerns | Consider if the measured two-second target is insufficient; does not replace authoritative snapshots |

## Proposed API and state contracts

Add `users.study_revision BIGINT NOT NULL DEFAULT 0`, shared `users.study_timezone` with the approved Toronto default, and nullable `users.study_last_seen_at` for the account inactivity lease. Increment the revision in the same transaction as every visible study mutation: session start/stop/switch/adjust, totals reset/end-day, timer create/edit/archive, and account time-zone changes. Read-only calls do not increment it.

```typescript
type StudyClock = {
  server_now: string;       // UTC sample taken when composing the response
  study_timezone: string;
  day_date: string;
  day_start_at: string;     // Actual UTC day boundary, DST aware
  day_end_at: string;
};

type StudyStateResponse = StudyClock & (
  | { changed: false; revision: number }
  | {
      changed: true;
      revision: number;
      active_session: Session | null;
      timers: Array<Timer & { completed_today_seconds: number }>;
    }
);
```

`GET /api/study-state?known_revision=17&known_day=2026-10-25` returns an unchanged response only when both revision and account calendar day match. A full response includes archived timers for shared reporting names; the normal timer list filters archived entries. At midnight, return a full snapshot even without a write/revision change.

Read the revision, timer metadata/counters, completed daily allocation, and active session consistently. Reuse the account lock: acquire a short `FOR SHARE` account lock before reading the snapshot, and require all study writes to acquire the existing `FOR UPDATE` account lock first. Refresh ORM-cached account fields before reading the revision. Release the read transaction promptly; do not hold it while waiting for network events. This prevents a snapshot mixing pre-stop counters with post-stop active state under PostgreSQL's default isolation.

Snapshot reads are cache-disabled and account-authenticated. Keep unchanged polls small. Coalesce local refresh requests; never start a second poll while the first is running. There are no per-tick database writes.

Extend study-changing commands with `expected_revision` and, for start/switch/stop/reset/end-day, `expected_active_session_id` (`null` means the user observed no active session). Validate them after obtaining the account write lock. A mismatch returns 409 and a fresh state read; do not silently execute an action against a different active session. Keep the existing expected session timestamps for History/Schedule adjustments.

Normal explicit stops use server time. Remove browser wall-clock stop timestamps from the updated client. Reject unsafe legacy unversioned stop/switch/reset commands from old tabs with a reload-required response rather than letting an old sleeping browser damage a new session. Deploy the compatibility contract with its tests; old reads can remain available.

Do not persist elapsed ticks. For the current cycle display:

```text
displayed_seconds = persisted_cycle_total + max(0, floor((estimated_server_now - active_start) / 1000))
```

The approved daily display replaces the completed term with the snapshot's completed daily total and clip the active interval at `day_start_at` and `day_end_at`. Reuse the existing allocator for completed records. Use the same display calculation for the sidebar and main dial.

The frontend clock anchors a server timestamp to the request/response midpoint in `performance.now()`, estimates round-trip uncertainty, and advances from that anchor. Prefer low-latency samples and align scheduled ticks with estimated server-second boundaries. A sample with round-trip uncertainty above the one-second display target must not be presented as an accurate clock: retain the last good anchor when valid, otherwise show synchronization in progress and take a fresh sample after the slow request completes. Recalibrate on each successful sync, login, focus, `pageshow`, online, and return from a hidden tab. A visibility/sleep gap requires a fresh anchor before presenting the timer as synchronized. Never use a wall-clock jump as evidence to stop a session.

## Implementation tasks and verification gates

### Task 1: Authoritative snapshot and revision

**Create:** `backend/app/schemas/study_state.py`, `backend/app/services/study_state.py`, `backend/app/api/study_state.py`, `backend/alembic/versions/0005_study_sync.py`, `backend/tests/test_study_sync.py`.

**Modify:** `models/user.py`, `api/router.py`, session/timer services, totals/end-day APIs, and `scripts/check_migration.py`.

**Produces:** `GET /study-state` and one account revision atomically covering all study writes.

- [x] First write tests proving account isolation, unchanged responses, full responses on revision/day changes, and snapshot consistency during a stop.
- [x] Test that every listed write increments once, a no-op does not create a false edit, and rollback leaves the revision unchanged.
- [x] Add the migration and snapshot query. Extend the existing interval allocator for daily totals without a new aggregate table.
- [x] Move revision increments before existing timer-service commits so metadata and revision commit together; use the same account lock order throughout.
- [x] Run `python -m pytest tests/test_study_sync.py tests/test_session_adjustments.py -q` against disposable PostgreSQL and rehearse upgrade twice.

Example acceptance assertion:

```python
assert snapshot["active_session"] is None
assert snapshot["timers"][0]["cycle_total_seconds"] == 1800
# A concurrent stop must never return null active state with the old zero counter.
```

### Task 2: Safe cross-device commands and sleep policy

**Modify:** `schemas/session.py`, `services/sessions.py`, `api/sessions.py`, `api/totals.py`, `api/end_day.py`, and the relevant tests.

**Consumes:** Task 1 revision and locks. **Produces:** versioned commands, server-owned stop times, stale-command rejection.

- [x] Reproduce A-starts, B-switches, A-sends-stale-stop; expect 409 and B's newer session to remain active.
- [x] Test start/start, stop/adjust, reset/start, and simultaneous reset conflicts with separate database sessions.
- [x] Use server time for explicit stop/switch/reset. Remove remote-destructive inactivity behavior according to the approved policy.
- [x] Implemented account-wide heartbeats, persisted deadlines, server expiry ownership and restart recovery; tests prove one active device prevents expiry.
- [x] Reject old unsafe mutation payloads with a clear reload-required error; test an old client cannot stop a new-client session.
- [x] Run the focused backend tests and all existing session/counter regressions.

### Task 3: Shared frontend state and server clock

**Create:** `frontend/src/hooks/useStudySync.ts`, `frontend/src/utils/serverClock.ts`, `frontend/tests/studySync.test.tsx`, `frontend/tests/serverClock.test.ts`.

**Modify:** `TimerRuntimeContext.tsx`, `useActiveSession.ts`, `api/types.ts`, `api/dataEvents.ts`, `api/sessionAdjustments.ts`, and `EndDayButton.tsx`.

**Consumes:** Task 1 snapshots and Task 2 commands. **Produces:** one account-scoped synchronization loop and one derived timer clock.

- [x] Test one in-flight request, two-second foreground scheduling, visibility/reconnect refresh, account-switch cancellation, and stale response rejection.
- [x] Test two clients with wall clocks ten minutes apart derive the same elapsed second from the same server anchor.
- [x] Apply full snapshots atomically; accept equal revisions for clock calibration, reject lower revisions, and force a fresh read after uncertain mutation responses without replaying the write.
- [x] Remove the independent active-session poll and counter refresh loops once the coordinator supplies them. Keep BroadcastChannel only as a local prompt to synchronize.
- [x] Remove browser offsets from current calculations and stop payloads. Preserve ambiguous legacy pending offsets as recoverable local drafts with a compact notice, while displaying only shared server values. Applying one requires an explicit versioned session edit; do not silently apply or discard it. New-client automatic behavior never depends on local storage.
- [x] On failed sync retain the last snapshot with an unsynced indicator; disable destructive commands until a fresh revision is available. On 401 clear the account state and stop polling.
- [x] Run `npm.cmd test -- tests/study-sync.test.tsx tests/release.test.tsx tests/adjustments.test.tsx` (clock tests are included in `study-sync.test.tsx`).

Example clock test, with a fake monotonic clock and an independent literal expected value:

```typescript
expect(clock.elapsedSeconds("2026-10-25T14:00:00Z")).toBe(1800);
// Change mocked Date.now() by ten minutes; the calibrated elapsed value stays 1800.
```

### Task 4: All study views consume the same revision, date, and totals

**Modify:** `useApiResource.ts`, `useStudyDataRefresh.ts`, `useTimers.ts`, reporting hooks, `TimerSelectionContext.tsx`, `TimersPage.tsx`, `Sidebar.tsx`, `HistoryPage.tsx`, `SchedulePage.tsx`, `StatsPage.tsx`, and `DayTimeline.tsx`.

**Consumes:** shared snapshot, account time zone, and calibrated clock. **Produces:** synchronized visible study data and running timer presentation.

- [x] On a remote revision change invalidate mounted History/Schedule/Stats readers and reload their current filters; abort or ignore old responses. Keep current data visible during a refresh so polling does not blank rows or editors.
- [x] Give derived report reads a revision guard too. Add optional `expected_revision` to History/Schedule/Stats reads, acquire the same short account read lock before their data queries, and return 409 if that revision is obsolete. A successful guarded read holds the account lock for the requested revision, so the client verifies it against the current accepted revision without redundant response metadata. On mismatch fetch the new snapshot and retry the read, never a mutation. Release the transaction promptly.
- [x] Read timer metadata and counters from the snapshot rather than separate unsynchronized `useTimers` fetches.
- [x] Use the same account date/time zone in all default queries and labels. Maintain explicit historical filter ranges when the shared date rolls over.
- [x] Focus the shared active course on login and remote switches. Preserve open form contents while updating the running course indicator.
- [x] Pass the shared ticking time to History's active-duration rows and Schedule's active block. Keep completed sessions and selected editor data authoritative after refresh.
- [x] Test reset on A updates B to zero; switching/stop cannot mix old counters with new active state; old browser selections cannot make a running timer appear paused on login.
- [x] Run the full frontend suite and production build; verify the 900×700 layout.

### Task 5: Independent-device verification and rollout

**Create:** `scripts/verify_cross_device_sync.py` or an equivalent Playwright script using the existing installed tooling; document its disposable database setup and results in `docs/cross-device-sync.md`.

- [x] Use **two separate browser contexts/profiles**, distinct local storage, and independently authenticated cookies. Do not substitute same-profile tabs or call a test-only invalidation event to simulate the other device.
- [x] Run the acceptance matrix below against the actual frontend, API, and disposable PostgreSQL database.
- [x] Measure full/unchanged snapshot request count, latency, and pool usage with two active devices; verify no duplicate polling on route changes or React StrictMode. If the two-second target fails under normal load, revise the transport before declaring completion.
- [x] Run the full backend/frontend suites, production build, migration rehearsal, and independent code review.
- [ ] For a later deployment, verify both devices use the same frontend release, `VITE_API_BASE_URL`, account identity, shared database, and API signing configuration. Do not inspect or expose secret values in logs. Check actual hosting cold-start/reconnect behavior separately from local results.
- [ ] Deploy the schema/backend compatibility contract before the client; old unsafe client commands must already be guarded. Perform the real laptop/desktop smoke test before claiming deployed cross-device sync.

## Acceptance matrix

| Scenario | Evidence required |
| --- | --- |
| Login on B while A is running | Same active ID/course/start; same counters; calibrated display differs by at most one second after initial sync |
| Start, pause, switch, or reset on A | B converges within the polling target; no extra session and no double-counted seconds |
| Adjust History on A while Schedule is open on B, and reverse | Same persisted start/end/duration; fixed completed end; remote block updates and reports agree |
| Change a completed session while active ID stays unchanged | B detects revision change and refreshes counters/History/Schedule/Stats anyway |
| Sleep or close B while A continues, then reopen B | B does not stop/shorten A's work; B refreshes its snapshot and clock before enabling commands |
| B's system clock is ten minutes fast/slow or changes during a session | Display and saved stop duration remain server-derived |
| Network loss or lost mutation response | Unsynced state is clear; reconnect converges; no automatic duplicate mutation |
| Stale/competing commands from two devices | Deterministic success/conflict; one active session; unchanged data on rejected actions |
| Midnight, DST, and different OS time zones | Same account day and day bounds; active daily contribution clipped once; calendars and reports agree |
| Historical adjustment after Reset Totals | History/analytics update on both devices; reset counter membership remains correct |
| Fresh browser, stale storage, logout/account switch, and server restart | Shared data wins; no cross-account leaks, resurrected timer, or replayed offset |

Suggested implementation commits: (1) versioned backend snapshot and command guards, (2) shared frontend coordinator/clock and all-view integration, (3) independent-device regressions and rollout documentation. Commit only independently verified stages.

## References checked

- [MDN Broadcast Channel API](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API): local same-origin browsing-context communication; it is not a device-to-device transport.
- [MDN performance.now](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now): monotonic timing avoids wall-clock adjustments; sleep behavior requires explicit resume recalibration.
- [PostgreSQL 15 transaction isolation](https://www.postgresql.org/docs/15/transaction-iso.html): default Read Committed permits successive statements to observe different committed snapshots, motivating coherent snapshot reads.
