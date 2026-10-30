# Timer duration adjustments

The interval adjustment rules below still apply. Shared daily counters, clock
recovery, and legacy browser-draft handling now follow [cross-device synchronization](cross-device-sync.md).

## Behavior and data flow

The Timers page, History, and Schedule use the same backend adjustment operation.
Adding ten minutes subtracts 600 seconds from the session start. Subtracting five
minutes adds 300 seconds to the start, clamped at the end. Completed session ends
never change. Active sessions retain a null end until stopped. Arithmetic uses UTC
instants; calendar allocation uses the selected IANA time zone.

Pause retains the existing application model: it completes a session. Play creates
a new session, excluding the pause. A paused adjustment edits that timer's most
recent session. Reset Totals still preserves History and resets only cycle counters.

`POST /api/sessions/{id}/adjust` accepts `delta_seconds`, `expected_start_at`, and
`expected_end_at`. The server validates integer adjustments, checks ownership,
serializes study mutations per account, and rejects stale timestamps with HTTP 409.
The successful response is the authoritative session. Requests are never replayed
automatically. An uncertain response triggers fresh reads before another edit.

After a successful mutation, the existing study-data event refreshes History,
Schedule, course counters, and analytics. BroadcastChannel invalidates other tabs
without sharing account data. In-flight reads cannot overwrite a newer revision.
Running elapsed time derives from the saved start; stopped totals come from the
backend rather than locally accumulated offsets. Legacy browser adjustments are
carried once into stop/switch/reset requests and are not reapplied to completed
sessions.

Daily and weekly reports and averages reuse the existing `allocate_interval`
helper. Reports accept an optional `client_tz`; the UI sends its display zone.
Advanced analytics already uses this allocator, so repaired timestamps now also
correct heatmaps, hourly distribution, consistency, trends, and averages. Finalized
daily summaries are replaced from session data, including newly contributing
courses, rather than incremented. Schedule queries return overlapping intervals
on every touched day. Its timeline clips to actual day boundaries, accounts for
23/25-hour days, and lays overlapping blocks into columns. Minimum-height markers
for very short and zero sessions anchor to their end.

## Changed files and responsibilities

| Area | Files | Main changes |
| --- | --- | --- |
| Backend session flow | `backend/app/services/sessions.py`, `backend/app/api/sessions.py`, `backend/app/schemas/session.py` | `_move_start`, `adjust_session`, latest-session recovery, locking, consistent stop/switch logic, overlap-based Schedule queries, cache refresh |
| Reports and counters | `backend/app/services/stats.py`, `backend/app/api/stats.py`, `backend/app/api/totals.py`, `backend/app/models/timer.py` | Interval allocation, display-zone validation, exact reset boundary for future cycle counters |
| Data repair | `backend/alembic/versions/0004_session_adjustments.py`, `scripts/check_migration.py` | Repair old intervals and caches; add nullable `cycle_reset_at`; verify schema |
| Frontend mutation and state | `frontend/src/api/sessionAdjustments.ts`, `frontend/src/api/dataEvents.ts`, `frontend/src/hooks/useSessionAdjustment.ts`, `frontend/src/hooks/useStudySync.ts`, `frontend/src/context/TimerRuntimeContext.tsx` | Shared mutation, busy/error feedback, server-derived counters, stale-read protection, cross-tab invalidation |
| Data readers | `frontend/src/hooks/useScheduleDay.ts`, `useTimers.ts`, `useDayStats.ts`, `useStatsWeek.ts`, `useAverages.ts` | Shared invalidation and time-zone queries |
| UI | `frontend/src/routes/TimersPage.tsx`, `HistoryPage.tsx`, `SchedulePage.tsx`; `frontend/src/components/SessionAdjustmentControls.tsx`, `DayTimeline.tsx`, `SessionBlock.tsx`, `EndDayButton.tsx`; `frontend/src/utils/timeline.ts`, `frontend/src/styles.css` | Compact controls, selectable Schedule blocks and editor, overlap columns, reset interlock, fixed-end geometry |
| Tests | `backend/tests/test_session_adjustments.py`, `test_adjustment_migration.py`; `frontend/tests/adjustments.test.tsx`, `timeline.test.ts` | Persistence, active/paused recovery, API failures, synchronization, concurrency, caches, migration, zero sessions, midnight and DST |

No dependencies were added. The implementation reuses SQLAlchemy transactions,
Pydantic validation, Python `zoneinfo`, the existing interval allocator and resource
hooks, React state, and browser `Intl`/BroadcastChannel APIs. No files were deleted.

## Migration and compatibility

Run `alembic upgrade head` from `backend` before deploying the updated API and UI.
Revision `0004_session_adjustments` preserves every completed session's end and
recorded duration. Where timestamps disagree with recorded seconds, it derives the
start backward from the end and refreshes the saved date and daily caches. Cycle
counter values are preserved. It adds only one nullable timestamp column; there
is no new table or dependency.

Old versions did not save reset times. The migration infers the prior cycle boundary
from the newest completed durations that make up the counter. Exact historical
reset membership of zero-duration sessions cannot be recovered from the old data;
newer zero sessions remain expandable. Future resets record an exact boundary.
Downgrading removes the new column but retains the repaired timestamps.

## Verification

Use a prepared backend environment and a **disposable** PostgreSQL database named
`focusarc_test`, owned by `focusarc_test`, on localhost or `focusarc-test-db`. The
existing fixture refuses other targets and recreates the test schema.

```powershell
# From backend; TEST_DATABASE_URL must point only to that disposable database.
$env:DATABASE_URL = $env:TEST_DATABASE_URL
python -m pytest -q

# From frontend.
npm.cmd test
npm.cmd run build
```

For a separate empty migration database, set both `DATABASE_URL` and
`MIGRATION_DATABASE_URL` to that database, then from `backend` run:

```powershell
python -m alembic upgrade head
python -m alembic upgrade head
python ../scripts/check_migration.py
```

Manual browser verification at 900×700 covered:

1. Adjust a paused timer, refresh, and verify its end is unchanged.
2. Play, add ten minutes, pause, and verify the saved duration includes it once.
3. Edit from History, then Schedule, checking start, duration, and fixed block end.
4. Keep History open in another tab and verify Schedule edits arrive immediately.
5. Extend a session backward across midnight and verify both days show its block.
6. Inspect timer, History, and Schedule for usable controls and horizontal overflow.

Automated tests additionally cover zero clamping/re-expansion, DST gaps and folds,
API failure without replay, a stale in-flight poll, competing database transactions,
daily summary creation/replacement, display-zone reports, and post-migration edits.

Verification uses local disposable data. Production deployment is outside this change.
