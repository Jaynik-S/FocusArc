# FocusArc

FocusArc is a personal web app for tracking study time by course. It lets you run course-specific timers, records each session, and surfaces daily and weekly summaries so you can see where your time is going.

## Core Functionality

- Create and manage timers for individual courses.
- Track active study sessions and store session history.
- Review schedule-oriented views and day timelines.
- View lightweight analytics such as totals, averages, and weekly stats.

## Technical Overview

FocusArc is a two-tier application:

- `frontend/` is a React 18 single-page app built with Vite and TypeScript.
- `backend/` is a FastAPI service using SQLAlchemy ORM and PostgreSQL.

On the backend, `app/main.py` creates the API application, applies CORS from environment-based settings, and mounts all routes under `/api`. The main router splits public endpoints such as `/health` from user-scoped endpoints protected by a lightweight username-based auth layer. The frontend stores the selected username in `localStorage`, sends it in the `X-Username` header through a shared API client, and the backend uses that value to scope all timer, session, and stats operations to a single user.

Persistence is handled with SQLAlchemy models and Alembic migrations. `timers` store per-course metadata such as name, color, icon, archive status, and accumulated cycle totals. `sessions` store the start and end timestamps, computed duration, client timezone, and the derived `day_date` / `day_of_week` values used for reporting. Database constraints enforce important invariants, including unique timer names per user, non-negative durations, and a partial unique index that allows only one active session per user at a time.

The backend code is organized around route modules, schema modules, and service modules. Route handlers in `app/api/` translate HTTP requests into typed schema payloads, while service functions in `app/services/` encapsulate database reads and writes. Reporting logic is implemented with aggregate SQL queries rather than client-side recomputation: daily totals, weekly totals, and rolling averages are derived from session data, and day summary rows are upserted for efficient reuse.

On the frontend, `App.tsx` wires route-level pages for timers, schedule, history, and stats behind a username gate. Shared behavior lives in hooks and context providers rather than page-local state. In particular, `TimerRuntimeContext` coordinates the active session, elapsed time, local timer offsets, and session adjustments, persisting runtime state in `localStorage` so the interface can recover smoothly across refreshes. Presentation is split across reusable components such as timer cards, timelines, navigation, and weekly accordions, while `src/api/apiClient.ts` centralizes API base URL resolution, username header injection, JSON serialization, and error handling.

## Running Locally

Copy `.env.example` to `.env`, then start the stack:

```bash
docker compose up -d --build
```

- Frontend: `http://localhost:5173`
- Backend health check: `http://localhost:8000/api/health`

To inspect logs:

```bash
docker compose logs -f
```

To run database migrations manually:

```bash
docker compose exec api alembic upgrade head
```

## Repo Layout

- `backend/`: FastAPI app, SQLAlchemy models, Alembic migrations, and tests
- `frontend/`: React application built with Vite and TypeScript
