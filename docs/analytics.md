# Advanced analytics

Stats (`/stats`) has an **Overview** for interactive analytics and **Reports** for the existing daily, weekly, and average reports. All calculations use completed sessions; running activity appears after a stop, a timer switch, or Reset Totals. Resetting counters does not erase historical analytics.

## Filters and interactions

- Overview defaults to All Courses and 3 months: the last 90 calendar days, including today. The 12-month preset is exactly 365 days. Exact dates and the display time zone are shown.
- Custom ranges contain 1–365 inclusive dates and cannot end after today in the display zone. Zero days, including dates before the first recorded session, remain in the selection.
- Course selection includes archived courses. Metadata uses current saved names and colours; the database does not preserve past name/colour versions.
- Overview filters are encoded in the URL. Calendar drill-down carries the day, course, and display zone to History; browser Back restores the original selection.
- Arrow keys move through the calendar (up/down by day, left/right by week; Home/End within the week). Enter opens History. Pointer/focus tooltips show date, recorded duration, and touching session count. On touch, inspect a day and use its persistent History action or tap the day again.
- The hourly bars and weekly points support left/right keyboard navigation and focus details. Hollow weekly points indicate partial weeks.
- On narrow screens, the yearly calendar wraps into consecutive bands of at most 14 week columns. Charts stack; no dates are hidden.

## Calculation rules

**One display zone.** Overview starts with the browser's IANA zone and interprets every session in that zone, regardless of its original recorded zone. Activity History links preserve that exact zone. Saved session fields are never rewritten.

**Completed sessions only.** Analytics queries `sessions.end_at IS NOT NULL`. PostgreSQL filters ownership, optional course and actual timestamp overlap, joining timer ownership as well. Only required columns are loaded. Sessions are the sole source: `day_summaries` and `cycle_total_seconds` are never added, so reset counters and repeated end-day summaries cannot double-count study time.

**Recorded versus timed.** Recorded duration is `duration_seconds`, including persisted adjustments; null is treated as zero, as in the original reports. Timed duration is elapsed UTC time between persisted timestamps. Neither measures attention or productivity. Unpersisted adjustments and intervals removed by an existing session operation cannot be reconstructed.

**Midnight and adjustments.** Recorded duration is allocated proportionally to elapsed overlap with each local date. For recorded duration `R`, elapsed microseconds `W`, and clamped offsets `a` and `b`, allocation is `floor(R*b/W) - floor(R*a/W)`. Timed allocation is `floor(b/1_000_000) - floor(a/1_000_000)`. Integer microseconds and cumulative floors conserve whole seconds across independent day queries. A zero-length completed session with a positive adjustment belongs to its start's local date and contributes no hourly time.

For example, a 23:30–00:30 session with 7,200 recorded seconds contributes 3,600 recorded seconds to each date, but only 1,800 timed seconds to hour 23 and hour 0. Its range session count is one; each day's touching count is one. A session adjusted down to zero may still contribute timed activity without making a recorded active day.

**DST.** UTC boundary segments are labelled by their real local date/hour. Missing hours receive no elapsed activity; repeated hours accumulate into the same clock-hour bar. Fractional-offset and half-hour DST zones are supported. Historical midnight rollbacks can briefly re-enter the previous calendar date: queries use an envelope and the allocator checks each segment's actual date membership. Skipped civil dates remain empty calendar buckets. No session is assumed to last within one reporting day.

**Consistency and trends.**

| Value | Calculation |
|---|---|
| Recorded time | Allocated recorded seconds in selected dates. |
| Active days | Dates with positive recorded seconds. |
| Consistency | Active days / selected calendar days × 100, one decimal place. |
| Daily average | Recorded seconds / all selected dates, including zero days and today. |
| Session count | Distinct completed sessions actually touching the selected dates. |
| Weekly time | Recorded time grouped by Monday–Sunday, zero-filled. |
| Comparison | Two latest fully elapsed, complete weeks wholly contained in the selection. |
| Weekday pattern | Recorded time per occurrence of that weekday, including its zero dates. |

Today is never a fully elapsed day. Boundary/current weeks are marked partial and excluded from comparisons. With fewer than two comparable weeks the comparison is unavailable. A zero previous-week total has a duration delta but no percentage. All positive tied peak hours are highlighted; an empty histogram has no peak.

Calendar intensity thresholds are zero, under 30 minutes, 30–59 minutes, 1–2 hours, and 2+ hours. The bins stay fixed when filters change.

## Legacy reports and History

Reports retains `/stats/day`, `/stats/week`, and `/stats/averages` with independent day/week/day-count controls. These endpoints still group by the saved session start date. Averages still include active courses only and end on the API server's local today. Day/week displays now resolve archived course names and colours.

Ordinary History continues using saved dates and includes active sessions as before. Calendar links use `date_basis=activity`; this mode shows completed sessions with **duration attributed within the selected range**, alongside full-session duration and overnight date context. This explains intentional differences from legacy saved-date reports.

## API and implementation

Both endpoints inherit the existing signed-cookie authentication and derive username server-side:

```text
GET /api/stats/analytics?from=2026-10-01&to=2026-10-16&client_tz=America%2FToronto
GET /api/stats/analytics/sessions?from=2026-10-16&to=2026-10-16&client_tz=America%2FToronto
```

Both accept optional `timer_id` (UUID). Invalid date order, future end, ranges over 365 days, and invalid zones return 400. Malformed dates/UUIDs use standard 422 validation. Missing and foreign courses return the same generic 404. Archives remain readable by their owner.

The aggregate response contains `range`, `summary`, complete `daily`, `weekly`, 24 `hourly` buckets, and nullable `comparison`. The sessions endpoint preserves existing session fields and adds `range_recorded_seconds` and `range_timed_seconds`.

FastAPI owns time allocation and metrics; the frontend receives aggregates and draws native CSS/SVG charts. The same allocation helpers power drill-down. Read requests are account/query scoped and cancellable; late responses cannot replace newer filter results. Successful session/course mutations, visible focus, session identity changes, and date rollover trigger refresh without polling analytics every timer tick. Analytics responses are not stored in browser storage.

No schema migration, backfill, charting dependency, worker, cache service, or deployment change is required. `tzdata` supplies IANA data on platforms such as Windows where a system database may be absent. Existing PostgreSQL indexes are reused; query performance should be measured before introducing another index.

A local PostgreSQL 15.19 verification with 10,000 owned and 1,000 other-account sessions measured the 365-day endpoint at 213–268 ms over three warm runs. It issued one projected analytics query plus the existing authentication lookup. `EXPLAIN (ANALYZE, BUFFERS)` measured the broad-range query at 10.3 ms with shared-buffer hits and no disk reads or temporary spills. These are local observations, not production latency guarantees; no new index was warranted by this fixture.

## Tests

Use a disposable PostgreSQL database AND role named `focusarc_test` on localhost (or the existing CI hostname `focusarc-test-db`). The existing test guard refuses other targets; fixtures recreate tables. Never use a personal or hosted database.

From `backend`, with dependencies installed:

```powershell
$env:APP_ENV='dev'
$env:DATABASE_URL='postgresql+psycopg://focusarc_test:focusarc_test@127.0.0.1:5432/focusarc_test'
$env:TEST_DATABASE_URL=$env:DATABASE_URL
python -m pytest -ra
```

From `frontend` on Windows:

```powershell
npm.cmd test -- --configLoader runner
npm.cmd run build -- --configLoader runner
```

CI retains its existing standard commands. Tests cover midnight allocation, cumulative rounding, zero/null durations, DST gaps/folds and historical midnight rollback, archives, owner isolation, summary non-double-counting, query counts, partial/zero comparisons, History equality, filter navigation, stale responses, refresh, keyboard interaction, error recovery, and empty states.

## Local demo

For the ready-to-run Windows account `demo` / `demo12345`, an isolated database launcher, and Neon/Render steps, follow [the demo and release guide](analytics-demo-release.md). The generator also supports `--username demo --create-account`, prompting for a valid password and creating credentials/history in one transaction. It refuses to replace an existing account.

1. Run the application against a local development PostgreSQL database with `APP_ENV=dev`.
2. Register the dedicated `focusarc_demo` account through the normal UI. Leave it empty.
3. From `backend`, with that explicit local `DATABASE_URL`, run:

   ```powershell
   python -m app.demo_analytics --username focusarc_demo
   ```

The CLI refuses hosted targets, connection-routing overrides, service configuration, usernames other than `demo`/`focusarc_demo`, and accounts with any timers or sessions. It pins loopback addressing at connection time. It creates deterministic completed sessions over the previous 365 days for three active courses and one archived course, including quiet weeks, overnight adjustments, zero-length adjustments, and Toronto DST examples. It has no public seed endpoint and never overwrites or resets data. Use a fresh dedicated demo database for another run.

Show 3/12 months, filter an archived course, inspect a day, open matching History, return with Back, inspect hourly peaks and full-week comparisons, then start a timer and reset totals from Stats to demonstrate completion refresh. Finally open Reports to show that the original reporting remains available.
