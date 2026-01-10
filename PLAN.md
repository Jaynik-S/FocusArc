# CourseTimers — Implementation Plan

Local/personal web app to track time spent per course via multiple timers, session history, schedule views, and basic analytics. Stack: React + Vite (TS), FastAPI (Python), SQLAlchemy + Alembic, Postgres. Docker-first local dev and deployable to a PaaS.

---

## Architecture Overview

```mermaid
flowchart LR
  U[Browser\nReact + Vite] -->|REST (JSON)\nX-Username header| API[FastAPI\nSQLAlchemy\nAlembic]
  API --> DB[(Postgres)]
```

- Source of truth: Backend + Postgres (sessions/totals). Frontend displays live time based on server timestamps.
- Constraint: Only one running timer (active session) per username at a time (enforced by DB constraint + API logic).

---

## Data Model (Postgres)

### Conventions
- `timestamptz` stored in UTC.
- “Local day” is derived using the client’s IANA timezone (from the browser) at the time of the event; store `day_date` explicitly to keep queries simple and stable.
- Use UUID primary keys to simplify client-side caching and future sync.

### Tables

#### `users` (optional but recommended for integrity)
| Field | Type | Notes |
|---|---|---|
| `username` | `text` PK | Provided by user; normalized (trim); length constraint |
| `created_at` | `timestamptz` | default `now()` |

Constraints / indexes:
- `username` primary key
- `CHECK (char_length(username) BETWEEN 1 AND 32)`

#### `timers`
| Field | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | generated server-side |
| `username` | `text` FK → `users.username` | owner |
| `name` | `text` | course name like `BIO130` |
| `color` | `text` | e.g. `#3B82F6` |
| `icon` | `text` | short string, e.g. `book`, `flask` (or emoji) |
| `is_archived` | `boolean` | default `false` |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | updated on edits |

Constraints / indexes:
- `FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE`
- `UNIQUE (username, name)` to prevent duplicates per user (adjustable)
- `CHECK (char_length(name) BETWEEN 1 AND 32)`
- index: `(username, is_archived)`

#### `sessions`
Every start/stop creates/updates a row; active session has `end_at IS NULL`.

| Field | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | generated server-side |
| `username` | `text` FK → `users.username` | owner |
| `timer_id` | `uuid` FK → `timers.id` | course timer |
| `start_at` | `timestamptz` | server-stored UTC |
| `end_at` | `timestamptz` nullable | NULL while running |
| `duration_seconds` | `integer` | computed on stop/end-day; `end_at-start_at` |
| `client_tz` | `text` | IANA tz (e.g. `America/Toronto`) |
| `day_date` | `date` | local date of `start_at` in `client_tz` |
| `day_of_week` | `smallint` | `0=Mon..6=Sun` derived from `day_date` |
| `created_at` | `timestamptz` | default `now()` |

Constraints / indexes:
- `FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE`
- `FOREIGN KEY (timer_id) REFERENCES timers(id) ON DELETE CASCADE`
- `CHECK (end_at IS NULL OR end_at >= start_at)`
- `CHECK (duration_seconds IS NULL OR duration_seconds >= 0)`
- **Partial unique index** to enforce one active session per user:
  - `CREATE UNIQUE INDEX ux_sessions_one_active_per_user ON sessions(username) WHERE end_at IS NULL;`
- indexes:
  - `(username, day_date)`
  - `(username, timer_id, day_date)`
  - `(username, start_at)`

#### `day_summaries` (recommended for fast stats + “End Day” reset)
Stores totals “locked in” when user presses “End Day”. Also allows “Past week” stats without re-summing sessions repeatedly.

| Field | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `username` | `text` FK → `users.username` | |
| `day_date` | `date` | local day |
| `timer_id` | `uuid` FK → `timers.id` | |
| `total_seconds` | `integer` | >= 0 |
| `created_at` | `timestamptz` | default `now()` |

Constraints / indexes:
- `UNIQUE (username, day_date, timer_id)`
- `CHECK (total_seconds >= 0)`
- indexes:
  - `(username, day_date)`
  - `(username, timer_id, day_date)`

---

## REST API Specification (FastAPI)

### API conventions
- Base URL: `/api`
- Authentication: **username-only via request header** `X-Username: <string>`
  - Backend rejects missing/blank username (`400`) and normalizes `trim()`.
  - Backend auto-creates `users` row on first request (idempotent).
- JSON everywhere, `Content-Type: application/json`
- Error shape:
```json
{ "error": { "code": "string", "message": "string", "details": {} } }
```

### Data shapes
**Timer**
```json
{
  "id": "uuid",
  "name": "BIO130",
  "color": "#3B82F6",
  "icon": "book",
  "is_archived": false,
  "created_at": "2026-01-09T12:00:00Z",
  "updated_at": "2026-01-09T12:05:00Z"
}
```

**Session**
```json
{
  "id": "uuid",
  "timer_id": "uuid",
  "start_at": "2026-01-09T13:00:00Z",
  "end_at": "2026-01-09T13:45:00Z",
  "duration_seconds": 2700,
  "client_tz": "America/Toronto",
  "day_date": "2026-01-09",
  "day_of_week": 4
}
```

### Endpoints

#### Health
- `GET /api/health`
  - Response `200`:
```json
{ "status": "ok" }
```

#### Users (minimal, mostly implicit)
- `GET /api/me`
  - Purpose: validate/echo normalized username + return current active session (if any).
  - Response `200`:
```json
{
  "username": "jay",
  "active_session": null
}
```

#### Timers
- `GET /api/timers?include_archived=false`
  - Response `200`:
```json
{ "timers": [/* Timer[] */] }
```

- `POST /api/timers`
  - Request:
```json
{ "name": "BIO130", "color": "#22C55E", "icon": "flask" }
```
  - Response `201` (Timer)

- `PATCH /api/timers/{timer_id}`
  - Request (any subset):
```json
{ "name": "BIO130", "color": "#3B82F6", "icon": "book", "is_archived": false }
```
  - Response `200` (Timer)

- `DELETE /api/timers/{timer_id}`
  - Behavior: soft-delete by setting `is_archived=true` (safer for history); hard delete can be added later.
  - Response `204`

#### Active session / timer control
Key rule: **only one active session per user**.

- `GET /api/active-session`
  - Response `200`:
```json
{ "active_session": null }
```

- `POST /api/timers/{timer_id}/start`
  - Request:
```json
{ "client_tz": "America/Toronto", "started_at_client": "2026-01-09T08:00:00-05:00" }
```
  - Behavior:
    - If another timer is running: stop it first (finalize duration), then start requested timer.
    - If the requested timer is already running: idempotent no-op (return current active session).
    - Server uses `now()` for `start_at` (canonical). `started_at_client` is informational for debugging only (optional).
  - Response `200`:
```json
{
  "stopped_session": null,
  "active_session": { /* Session with end_at null */ }
}
```

- `POST /api/stop`
  - Request:
```json
{ "stopped_at_client": "2026-01-09T09:12:03-05:00" }
```
  - Behavior: stops current active session (if any) and computes `duration_seconds`.
  - Response `200`:
```json
{ "stopped_session": null }
```

- `POST /api/end-day`
  - Request:
```json
{ "client_tz": "America/Toronto", "day_date": "2026-01-09" }
```
  - Behavior:
    1) Stop any active session.
    2) Aggregate totals for `day_date` across sessions (or live totals) and upsert into `day_summaries`.
    3) Return per-timer totals for that day.
    4) “Resets counters” is purely a UI concept: backend has persisted totals; frontend displays 0 for the new day.
  - Response `200`:
```json
{
  "ended_day_date": "2026-01-09",
  "finalized": true,
  "totals": [
    { "timer_id": "uuid", "total_seconds": 5400 }
  ]
}
```

#### Sessions + schedule/history
- `GET /api/sessions?from=2026-01-01&to=2026-01-31&timer_id=<uuid optional>`
  - Returns sessions with `start_at` within range (server-side uses `day_date` filtering for speed + stability).
  - Response `200`:
```json
{ "sessions": [/* Session[] */] }
```

- `GET /api/schedule/day?day_date=2026-01-09`
  - Response `200`:
```json
{
  "day_date": "2026-01-09",
  "sessions": [/* Session[] sorted by start_at */]
}
```

- `GET /api/schedule/week?week_start=2026-01-05`
  - `week_start` is a local Monday (client chooses).
  - Response `200`:
```json
{
  "week_start": "2026-01-05",
  "days": [
    { "day_date": "2026-01-05", "sessions": [] }
  ]
}
```

#### Stats / analytics
- `GET /api/stats/day?day_date=2026-01-09`
  - Response `200`:
```json
{
  "day_date": "2026-01-09",
  "totals": [
    { "timer_id": "uuid", "total_seconds": 5400 }
  ]
}
```

- `GET /api/stats/week?week_start=2026-01-05`
  - Response `200`:
```json
{
  "week_start": "2026-01-05",
  "daily": [
    {
      "day_date": "2026-01-05",
      "totals": [{ "timer_id": "uuid", "total_seconds": 3600 }]
    }
  ]
}
```

- `GET /api/stats/averages?days=14`
  - Returns average seconds/day per timer across the last N days (including zero days when no study happened).
  - Response `200`:
```json
{
  "days": 14,
  "averages": [
    { "timer_id": "uuid", "avg_seconds_per_day": 1800 }
  ]
}
```

---

## UI/UX Plan

### Routes (React Router)
- `/` — Username gate (first-run + change username)
- `/timers` — Main “Today” view: timers + live running indicator + End Day
- `/schedule` — Calendar-like schedule with Day/Week tabs
- `/history` — Session list (filter by date range + timer)
- `/stats` — Totals/averages for day + week + per-course summary
- `/settings` — Optional: timezone display, data export/import (later)

### Global UI principles (narrow layout first)
- Target narrow container: **~320px wide** (or “25% width column”) with no horizontal scroll.
- Spacing scale: 4/8/12px; typography: 14px base, 12px secondary.
- Use a single top nav bar with **icon-only** tabs + tooltips; show labels only when width allows.
- Prefer **accordions** and **bottom sheets** (mobile patterns) instead of side-by-side panes.
- All lists: one primary line + one muted metadata line; actions grouped in a “⋯” menu when needed.
- For schedule: default to **Day view** in narrow widths; Week view becomes an accordion list of days.

### Screen details

#### `/` Username gate
- Components:
  - `UsernameCard` (input + “Continue”)
  - `RecentUsernames` (optional localStorage list)
- Behavior:
  - Store username in `localStorage` and set on API client as `X-Username`.

#### `/timers` (Today)
- Components:
  - `TopBar` (tabs + username)
  - `ActiveBanner` (shows running timer + elapsed)
  - `TimerList`
  - `TimerCard` (name, icon/color chip, elapsed today, Start/Stop button)
  - `CreateTimerModal` (name + color + icon)
  - `EndDayButton` (prominent, confirmation)
- Interactions:
  - Start: stops any active session, starts selected timer (single button).
  - Stop: stops active session.
  - Timer customization: edit modal (simple fields).

#### `/schedule`
- Components:
  - `ScheduleHeader` (Day/Week toggle, date picker)
  - `DayTimeline` (vertical timeline with session blocks)
  - `WeekAccordion` (7 collapsible days, each showing mini timeline or compact blocks)
  - `SessionBlock` (color-coded by timer, shows time range + duration)
- Narrow rendering rules:
  - Day view: timeline with hour labels every 2 hours; blocks full width.
  - Week view: accordion; each day row shows stacked blocks with start/end times (no complex grid).

#### `/history`
- Components:
  - `DateRangePicker` (start/end)
  - `TimerFilterChips`
  - `SessionList` (virtualized optional; keep simple first)
  - `SessionRow` (timer name, time range, duration)

#### `/stats`
- Components:
  - `DayTotalsCard` (per timer)
  - `WeekTotalsCard` (per day + per timer)
  - `AveragesCard`
  - Optional `BarChart` (lightweight): use `recharts` or `uPlot` only if needed; otherwise use CSS bars.

### Frontend state + API client
- `apiClient.ts`: attaches `X-Username` header from `localStorage`.
- Cache strategy: React Query (TanStack Query) to simplify fetching + invalidation.
- Live timer display:
  - Poll `GET /api/active-session` every ~10–15s (or on focus).
  - Locally update displayed elapsed each second using `Date.now()` vs last server `start_at`.
  - On refresh, compute elapsed from server `start_at` so it stays accurate.

---

## Time Handling Plan (critical)

### Assumptions
- Store all timestamps in UTC (`timestamptz`).
- Use browser timezone as “truth” for determining a user’s local day:
  - `client_tz = Intl.DateTimeFormat().resolvedOptions().timeZone`
- Derive `day_date` (local date) **on the server** using `client_tz` supplied with start/end/end-day calls.

### Local day boundaries
- A session’s `day_date` is the local date of its `start_at` in `client_tz`.
- **Prevent cross-day sessions** to keep daily totals correct:
  - On `POST /api/stop` and `POST /api/end-day`, server checks whether the active session’s local day matches “today” (`day_date` provided by client for the action).
  - If it differs, server force-ends the session at the previous day’s local `23:59:59.999` (converted to UTC) and sets `duration_seconds` accordingly. The UI then requires the user to start again for the new day.
  - This keeps data consistent with the “End Day resets day counters” mental model.

### “End Day” behavior
- The button always sends `client_tz` and the day being ended (`day_date`).
- Server procedure:
  1) Stop active session (applying cross-day rule).
  2) Compute totals for `day_date` by timer (sessions + any already summarized).
  3) Upsert into `day_summaries` for each timer with total seconds.
  4) Return totals so frontend can show a “Day finalized” summary toast.
- Frontend resets “Today counters” by switching to the new local day (or by re-fetching stats for “today”), not by deleting data.

---

## Analytics: Queries (SQL patterns)

### Per-day totals (by timer)
Prefer `day_summaries` if available; fallback to sessions if not.

```sql
-- day totals from sessions
SELECT timer_id, COALESCE(SUM(duration_seconds), 0) AS total_seconds
FROM sessions
WHERE username = :username AND day_date = :day_date AND end_at IS NOT NULL
GROUP BY timer_id;
```

### Past week totals (daily breakdown)
```sql
SELECT day_date, timer_id, COALESCE(SUM(duration_seconds), 0) AS total_seconds
FROM sessions
WHERE username = :username
  AND day_date BETWEEN :week_start AND (:week_start::date + 6)
  AND end_at IS NOT NULL
GROUP BY day_date, timer_id
ORDER BY day_date, timer_id;
```

### Average time per day per course (include zero days)
Approach: generate series of dates, left join totals.
```sql
WITH days AS (
  SELECT generate_series(
    (:end_date::date - (:days - 1) * interval '1 day')::date,
    :end_date::date,
    interval '1 day'
  )::date AS day_date
),
totals AS (
  SELECT day_date, timer_id, SUM(duration_seconds) AS total_seconds
  FROM sessions
  WHERE username = :username
    AND day_date BETWEEN (SELECT MIN(day_date) FROM days) AND (SELECT MAX(day_date) FROM days)
    AND end_at IS NOT NULL
  GROUP BY day_date, timer_id
)
SELECT t.id AS timer_id,
       AVG(COALESCE(totals.total_seconds, 0))::int AS avg_seconds_per_day
FROM timers t
CROSS JOIN days
LEFT JOIN totals ON totals.timer_id = t.id AND totals.day_date = days.day_date
WHERE t.username = :username AND t.is_archived = false
GROUP BY t.id;
```

---

## Step-by-Step Build Plan (0..N)

> Each step is intentionally small and independently verifiable.

### 0) Repo bootstrap + tooling choices
- Goal: establish structure and conventions.
- Files:
  - Create: `README.md`, `.env.example`, `.gitignore`
  - Create directories: `backend/`, `frontend/`
- Commands:
  - `git init` (if needed)
- Acceptance checks:
  - Repo has `backend/` + `frontend/` placeholders and `.env.example` documenting required env vars.

### 1) Docker Compose: Postgres for local dev
- Goal: run Postgres locally with persistent volume.
- Files:
  - Create: `docker-compose.yml`
  - Create: `docker/postgres/init.sql` (optional; can be empty)
- Commands:
  - `docker compose up -d db`
- Acceptance checks:
  - `docker compose ps` shows `db` healthy.
  - Connection works using `psql` with values from `.env.example`.

### 2) Backend skeleton (FastAPI) + settings
- Goal: boot FastAPI with `/api/health`.
- Files:
  - Create: `backend/pyproject.toml`
  - Create: `backend/app/main.py`
  - Create: `backend/app/settings.py`
  - Create: `backend/app/api/router.py`
- Commands:
  - `cd backend`
  - `python -m venv .venv`
  - `pip install -e .`
  - `uvicorn app.main:app --reload --port 8000`
- Acceptance checks:
  - `GET http://localhost:8000/api/health` returns `{ "status": "ok" }`.

### 3) SQLAlchemy + Alembic migrations wired
- Goal: DB connectivity + migration baseline.
- Files:
  - Create: `backend/app/db.py`, `backend/app/models/base.py`
  - Create: `backend/alembic.ini`, `backend/alembic/` (env + versions)
  - Create initial models: `backend/app/models/user.py`, `backend/app/models/timer.py`, `backend/app/models/session.py`, `backend/app/models/day_summary.py`
- Commands:
  - `alembic revision --autogenerate -m "init schema"`
  - `alembic upgrade head`
- Acceptance checks:
  - Tables exist in Postgres; partial unique index for active session present.

### 4) Username middleware/dependency
- Goal: consistently require `X-Username` and auto-create user row.
- Files:
  - Create: `backend/app/auth.py` (dependency `get_username()`)
  - Modify: `backend/app/api/router.py` to apply dependency per router
  - Add: `GET /api/me`
- Commands:
  - `pytest` (can be empty initially; create test scaffold in Step 10)
- Acceptance checks:
  - Requests without `X-Username` return `400`.
  - First request with new username creates `users` row.

### 5) Timers CRUD API
- Goal: create/list/update/archive timers.
- Files:
  - Create: `backend/app/api/timers.py`
  - Create: `backend/app/schemas/timer.py` (Pydantic)
  - Create: `backend/app/services/timers.py` (DB logic)
- Commands:
  - `uvicorn app.main:app --reload`
- Acceptance checks:
  - Can `POST /api/timers`, then `GET /api/timers` returns it.
  - `UNIQUE (username, name)` enforced (duplicate returns `409`).

### 6) Session control API: start/stop + single-active enforcement
- Goal: correct session creation/closure and no overlaps.
- Files:
  - Create: `backend/app/api/sessions.py` (start, stop, active-session)
  - Create: `backend/app/schemas/session.py`
  - Create: `backend/app/services/sessions.py` (transactional logic)
- Commands:
  - Manual API test using `curl`/REST client.
- Acceptance checks:
  - Starting a timer while another runs stops the old one and starts the new one atomically.
  - DB constraint prevents two active sessions even under race (verify by concurrent requests or unit test later).

### 7) End Day endpoint + day summaries
- Goal: finalize day totals and “reset” for new day (UI).
- Files:
  - Modify: `backend/app/services/sessions.py` (force-stop cross-day sessions)
  - Create: `backend/app/api/end_day.py`
  - Create: `backend/app/services/stats.py` (aggregation + upsert day_summaries)
- Commands:
  - `alembic revision --autogenerate -m "add day_summaries"` (if not already)
  - `alembic upgrade head`
- Acceptance checks:
  - `POST /api/end-day` stops any active session and returns per-timer totals.
  - Repeating end-day for same date is idempotent (upsert).

### 8) Sessions list + schedule endpoints
- Goal: fetch sessions for history and schedule views.
- Files:
  - Add endpoints: `GET /api/sessions`, `/api/schedule/day`, `/api/schedule/week`
  - Add service queries with indexes used (filter by `day_date`).
- Commands:
  - Smoke test with seeded sessions (manual insert or dev endpoint behind `APP_ENV=dev`).
- Acceptance checks:
  - Week endpoint returns 7 days with sessions grouped; ordering correct.

### 9) Stats endpoints (day/week/averages)
- Goal: correct aggregation and date math.
- Files:
  - Create: `backend/app/api/stats.py`
  - Extend: `backend/app/services/stats.py`
- Commands:
  - Manual verification with known data set.
- Acceptance checks:
  - Day totals match sum of session durations.
  - Averages include zero days (verify with a timer with no sessions).

### 10) Backend tests (unit + integration)
- Goal: confidence in timer/session rules.
- Files:
  - Create: `backend/tests/test_sessions_unit.py` (pure logic helpers)
  - Create: `backend/tests/test_api_integration.py` (FastAPI TestClient or httpx)
  - Create: `backend/tests/conftest.py` (DB fixture, cleanup)
- Commands:
  - `pytest -q`
- Acceptance checks:
  - Tests cover: single-active enforcement, start->stop duration, end-day stops active, cross-day stop behavior.

### 11) Frontend skeleton (Vite + TS) + routing
- Goal: app shell with routes and username gate.
- Files:
  - Create: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/src/main.tsx`
  - Create: `frontend/src/routes/*`, `frontend/src/components/*`
  - Create: `frontend/src/api/apiClient.ts`
- Commands:
  - `cd frontend`
  - `npm install`
  - `npm run dev`
- Acceptance checks:
  - Username prompt persists to localStorage and navigates to `/timers`.

### 12) Timers page + live elapsed display
- Goal: create/edit timers and start/stop with accurate timing across refresh.
- Files:
  - Create: `frontend/src/pages/TimersPage.tsx`
  - Create: `frontend/src/components/TimerCard.tsx`, `CreateTimerModal.tsx`
  - Add hooks: `useActiveSession`, `useTimers`
- Commands:
  - `npm run dev`
- Acceptance checks:
  - Starting timer shows running state and elapsed increments.
  - Refresh keeps elapsed correct (derived from `start_at`).

### 13) End Day UI flow
- Goal: finalize day with confirmation and reset display.
- Files:
  - Add: `EndDayButton.tsx` + confirmation modal
  - Update: timers page to show “today totals” from `/api/stats/day`
- Commands:
  - `npm run dev`
- Acceptance checks:
  - Pressing End Day stops running timer and shows totals returned from API; “today” counters reset.

### 14) Schedule view (day + week) in narrow layout
- Goal: calendar-like visualization that works at small widths.
- Files:
  - Create: `frontend/src/pages/SchedulePage.tsx`
  - Create: `DayTimeline.tsx`, `WeekAccordion.tsx`, `SessionBlock.tsx`
  - CSS: `frontend/src/styles/*`
- Commands:
  - `npm run dev`
- Acceptance checks:
  - Day view shows blocks positioned by time; week view shows per-day accordions.
  - Usable at ~320px without horizontal scroll.

### 15) History + Stats pages
- Goal: browse sessions and see analytics.
- Files:
  - Create: `frontend/src/pages/HistoryPage.tsx`, `StatsPage.tsx`
  - Components: `SessionList`, `TotalsTable`, optional `BarChart`
- Commands:
  - `npm run dev`
- Acceptance checks:
  - Filtering sessions works; stats match backend values.

### 16) Full Docker dev setup (frontend + backend)
- Goal: one-command local dev with containers.
- Files:
  - Create: `backend/Dockerfile`, `frontend/Dockerfile`
  - Modify: `docker-compose.yml` (services: `db`, `api`, `web`)
  - Add: `CORS_ORIGINS` config
- Commands:
  - `docker compose up --build`
- Acceptance checks:
  - `web` served on `localhost:5173` (or `80`) and talks to `api`.
  - Migrations run on startup (or via a one-off `migrate` service).

### 17) Deploy plan (PaaS) + docs
- Goal: deployable outside local machine.
- Files:
  - Update: `README.md` (local dev + deployment)
  - Add: `render.yaml` (Render)
- Commands:
  - PaaS CLI commands vary (documented in README).
- Acceptance checks:
  - Clear instructions exist for provisioning Postgres + setting env vars.

---

## Docker + Environment Variables

### Required env vars
- Backend:
  - `DATABASE_URL=postgresql+psycopg://user:pass@db:5432/coursetimers`
  - `APP_ENV=dev|prod`
  - `CORS_ORIGINS=http://localhost:5173` (comma-separated allowed)
  - `LOG_LEVEL=info`
- Frontend:
  - `VITE_API_BASE_URL=http://localhost:8000/api`

### Local dev compose
- Services: `db` (Postgres), `api` (FastAPI), `web` (Vite dev server or built static served by nginx).
- Volume: `pgdata` for persistence.

---

## Testing Plan

### Backend unit tests (fast, no HTTP)
- Timer/session rules:
  - Start a timer when none active → creates active session.
  - Start another timer → ends previous session, creates new session.
  - Stop when none active → no-op.
  - Duration computed correctly (mock time).
  - Cross-day stop rule ends at day boundary.

### Backend integration tests (real DB recommended)
- Use `pytest` + `httpx` against FastAPI app with a test Postgres DB:
  - Option A (simplest): dedicated `coursetimers_test` DB in the same Postgres container.
  - Option B: `testcontainers` (more isolated; heavier).
- Cover:
  - Timers CRUD
  - Start/stop creates sessions, enforces single-active
  - End-day writes `day_summaries`
  - Stats endpoints match expected aggregates

### Frontend tests (optional for this scope)
- If added: minimal component tests for `TimerCard` and `DayTimeline` positioning logic.

---

## Deployment Recommendation (Vercel-like PaaS)

Vercel is great for static/frontends but not ideal for a stateful FastAPI + Postgres stack via Docker without extra services.

Recommended options:
- **Render**: easiest “web service + managed Postgres”; supports Docker; straightforward env vars; good for personal apps.
- **Fly.io**: strong Docker support and low-latency; Postgres via Fly Postgres (extra ops).
- **Railway**: very simple for small projects; Postgres add-on; pricing/limits vary.

Suggested approach:
- Deploy frontend separately (Vercel/Netlify) if desired, and backend on Render/Fly/Railway.
- Or deploy both as Docker services on the same PaaS if supported (often easier to keep CORS simple).

---

## Potential Flaws / Risks + Mitigations

- **Tab closes / refresh while timer running**: session remains active server-side; on reopen, UI fetches `active_session` and resumes display from `start_at`.
- **System sleep / clock drift**: rely on server timestamps (`start_at`/`end_at` set by server), not client elapsed; UI is just a view.
- **Multiple tabs with same username**: two tabs could race to start; DB partial unique index prevents overlapping actives; API returns consistent state. Frontend should re-fetch active session after start/stop.
- **Midnight boundary without “End Day”**: cross-day rule on stop/end-day prevents a single session from spanning days; user may need to restart timer in the morning.
- **Network loss while running**: timer still runs server-side; UI can show “offline” state and keep optimistic display; on reconnect, re-sync from server.
- **Accidental username mismatch**: show current username in top bar and allow quick switch in `/` route; store recent usernames locally.
- **Performance on large history**: start with indexed queries and date filtering; add pagination (`limit/offset`) if needed.
- **Data correction**: no editing sessions in v1; if needed later, add admin-style edit endpoint guarded by username-only (still local use).

---

## Appendix: Schedule Rendering Logic (narrow view)

### Day timeline algorithm
- Input: sessions for a day (sorted).
- Compute minutes since local midnight for start/end (use `client_tz` to format times).
- Visual mapping:
  - `pxPerMinute = 1.2` (tune); `top = minutesStart * pxPerMinute`; `height = max(12px, durationMinutes * pxPerMinute)`
  - Overlaps: since only one timer runs at once, sessions should not overlap; if they do (data anomaly), stack with small horizontal offsets.

### Week view in narrow layout
- Default: accordion per day.
- Each day panel: compact list of blocks with `(HH:MM–HH:MM)` + duration; optional mini timeline.

