# Cross-device study synchronization

## Behavior

All signed-in devices use the account's PostgreSQL study data and **America/Toronto**
calendar day. The main dial and sidebar show **Today**: completed study intervals
allocated to today plus the running session's contribution clipped to today's
actual UTC boundaries. The count rolls over at Toronto midnight, including DST.

History and Schedule continue to save +10/−5 adjustments by moving starts and
preserving completed ends. A change on either device refreshes open History,
Schedule, Stats, course metadata, and counters on the other device. An active
course switch follows across devices; deliberately browsing another course is
retained until the next active-course change.

The **Reset cycle counters** action stops the current session and clears the
separate cycle counters. It does not delete history or erase today's study time.
Legacy browser offsets are excluded from shared counters. Their drafts remain
stored with a notice; a draft for the current active session can be explicitly
applied through the normal versioned adjustment operation. Ambiguous older
completed-session or timer-level drafts remain available for manual review.

## State and clock flow

`GET /api/study-state` returns an account-bound snapshot: username, revision,
server time, Toronto day and UTC day boundaries, inactivity deadline, active
session, all course metadata, and completed daily totals. Supplying the accepted
revision and day allows an unchanged response without another copy of the course
and session payload. Full reads hold a short account read lock so session and
counter values cannot straddle a concurrent stop.

The frontend uses one coordinator per signed-in account. It refreshes every two
seconds while visible, reconciles after mutations, and refreshes on focus,
visibility, pageshow, and reconnect. It coalesces requests and ignores obsolete
responses. Derived History/Schedule/Stats reads carry the accepted revision and
retry only reads after reconciliation. A same-filter background refresh keeps
existing rows visible.

The live timer advances from calibrated server time using `performance.now()`;
`Date.now()` only helps detect suspension or clock jumps. Ticks align with server
second boundaries. Slow or old clock samples mark the UI unsynchronized rather
than enabling commands with an unreliable clock. Initial routes wait for the
first account snapshot, avoiding device-local dates or invalid empty dates.

Study requests include an expected-account query assertion while cookie sessions
remain the authentication mechanism. Snapshots also identify their owner. If
another tab changes the shared browser cookie to a different account, the old
coordinator clears its state and returns to sign-in. A mismatch never causes an
unguarded read retry or a replayed mutation.

## Automatic inactivity stopping

Each awake signed-in browser sends a heartbeat every 30 seconds, including while
its tab is hidden and JavaScript is still running. Any device's valid heartbeat
renews the account-wide lease for the current session. It is not keyboard/mouse
idle detection: studying beside an open app still keeps the timer running.

After **five minutes with no account heartbeat**, the server stops the session
at the last received heartbeat, excluding the suspended grace period as the
previous behavior intended. Last activity is therefore bounded by the heartbeat
cadence; there can be up to roughly 30 seconds of unconfirmed time at disconnect.
A sleeping observer never submits a browser-generated stop request.

A 15-second server sweeper expires stale leases with account locks and
`SKIP LOCKED`, so multiple API workers cannot double-finalize a session. Reads
and commands also check expiry before renewal or action. If hosting suspends
the API process, the persisted deadline is applied on its next request; there is
no claim that a suspended process executes its background sweep on schedule.

Late heartbeats cannot revive an expired timer. Explicit stop/switch/reset uses
server time and checks both the observed account revision and active session ID.
An obsolete action returns a conflict and reconciles; it never stops an unseen
newer session.

## Main files and responsibilities

| Files | Purpose |
| --- | --- |
| `backend/app/services/study_state.py`, `backend/app/api/study_state.py`, `backend/app/schemas/study_state.py` | Snapshot reads, account/revision guards, heartbeat renewal, expiry and response contracts |
| `backend/app/models/user.py`, `backend/alembic/versions/0005_study_sync.py`, `scripts/check_migration.py` | Persist `study_revision`, `study_timezone`, and `study_last_seen_at`; verify migrated schema |
| `backend/app/services/sessions.py`, `services/timers.py`, session/totals/end-day APIs and schemas | Atomic revisions with writes, guarded commands, server-owned explicit stop timestamps |
| `backend/app/main.py`, `api/router.py` | Sweeper lifecycle and authenticated request guards |
| `frontend/src/hooks/useStudySync.ts`, `utils/serverClock.ts`, `api/studySyncState.ts` | One request coordinator, calibrated clock, account-scoped state bridge |
| `frontend/src/context/TimerRuntimeContext.tsx`, `hooks/useActiveSession.ts` | Shared daily counters and active state; compatibility entry point; explicit legacy draft recovery |
| `frontend/src/api/apiClient.ts`, `api/sessionAdjustments.ts`, `api/dataEvents.ts` | Expected account binding, versioned edits, local invalidation and cross-tab prompts |
| `frontend/src/hooks/useApiResource.ts`, `useTimers.ts`, `useReportingTimers.ts`, reporting hooks, `utils/studyDate.ts` | Revision-aware readers, shared metadata, background retention and shared-zone queries |
| `frontend/src/App.tsx`, timer selection context, timer/History/Schedule/Stats routes and associated components | Initial snapshot gate, Today presentation, shared dates/ticks, guarded controls and cycle reset copy |
| `backend/tests/test_study_sync.py`, `study_helpers.py`, existing session API tests | Real PostgreSQL concurrency, leases, isolation, daily allocation, migration and compatibility regressions |
| `frontend/tests/study-sync.test.tsx`, `study-readers.test.tsx`, `sync-ui.test.tsx`, `app-sync.test.tsx`, existing release/adjustment/analytics tests | Clock skew, polling, owner mismatch, account lifecycle, reader ordering and view behavior |
| `scripts/verify_cross_device_sync.js` | Actual two-profile browser/API/database verification, including the real five-minute inactivity deadline |

No dependencies or new aggregate tables were added. The implementation uses
existing SQLAlchemy transactions and row locks, the interval allocator, React
state and effects, browser monotonic timing and existing BroadcastChannel prompts.
No source files were deleted; the old active-session hook remains a compatibility
entry point to the shared coordinator.

## Validation and reproduction

Backend tests require the existing guarded **disposable** PostgreSQL database
`focusarc_test`, owned by `focusarc_test`, on localhost or `focusarc-test-db`.
The fixture recreates its schema; never point it at a personal or hosted database.

```powershell
# From backend, with both variables pointing to that disposable test database.
python -m pytest -q

# From frontend.
npm.cmd test
npm.cmd run build
```

For a separate empty migration database, set `DATABASE_URL` and
`MIGRATION_DATABASE_URL` to it and run from `backend`:

```powershell
python -m alembic upgrade head
python -m alembic upgrade head
python ../scripts/check_migration.py
```

The browser verifier is intentionally restricted to a disposable API on port
8002 and a frontend on `http://localhost:5175` configured to use that API. It
creates local-only accounts and two independent browser contexts, each logging
in through the UI. Screenshots go to the ignored `.deployment-private` directory.

```powershell
playwright-cli.cmd -s=sync-check open http://localhost:5175 --browser=chrome
playwright-cli.cmd -s=sync-check run-code --filename=scripts/verify_cross_device_sync.js
playwright-cli.cmd -s=sync-check close
```

The full verifier takes about six minutes because it waits for real server
inactivity expiry with both profiles offline. For a quick smoke run, open
`http://localhost:5175/?skip_idle=1`; its report explicitly records that the
deadline was skipped. Browser request timeouts and offline console messages in
that scenario are expected; uncaught page errors fail verification.

Verified locally: **185 backend tests**, **80 frontend tests**, production build,
and fresh-database upgrade applied twice. The browser smoke profiles used Tokyo
and Los Angeles OS zones with JavaScript clocks ten minutes fast and slow. They
verified equal live seconds, start/pause and History/Schedule propagation, fixed
ends, stale-command rejection, cycle reset preserving today, stale-observer
safety, and account-cookie switch isolation. The full real-deadline run also
passed: after 315.7 seconds of waiting with both profiles offline, the background
sweeper had stopped the session at the last account heartbeat. Reconnecting both
profiles restored the same paused daily total. Observed start propagation was
2,047 ms, History-to-Schedule propagation 2,001 ms, and live timer difference zero
seconds despite the opposite clock offsets.

A separate 35-second steady-state check after route changes observed 17 snapshot
reads per profile, at most one in flight per profile, and one periodic heartbeat
from each. Across 100 database activity samples, the API peaked at two open
connections and one active query for the two-profile workload.

## Rollout

Apply migration `0005_study_sync` before deploying the API and frontend. It adds
three account fields and grants existing active accounts a fresh five-minute
lease. Existing sessions, adjusted intervals, and completed study data remain.

Old unsafe start/stop/reset/end-day clients receive a reload-required conflict;
they must reload to use guarded commands. Deploy the backend guard before the
new frontend. Confirm both computers load the same frontend release and API URL
and log into the same account. Hosted cold starts, process suspension and actual
physical-device smoke checks are deployment checks, separate from these local
independent-profile results. This change does not deploy or alter production.
