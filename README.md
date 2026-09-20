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

On the backend, `app/main.py` mounts routes under `/api`. Hosted personal mode checks a private bearer key before database access and uses the server-configured owner (`jayy`). The API stores only the key's SHA-256 digest; the browser keeps the key in sessionStorage. Locking removes access without erasing local counters. Username-only mode is available for local development only and is not authentication.

Persistence is handled with SQLAlchemy models and Alembic migrations. `timers` store per-course metadata such as name, color, icon, archive status, and accumulated cycle totals. `sessions` store the start and end timestamps, computed duration, client timezone, and the derived `day_date` / `day_of_week` values used for reporting. Database constraints enforce important invariants, including unique timer names per user, non-negative durations, and a partial unique index that allows only one active session per user at a time.

The backend code is organized around route modules, schema modules, and service modules. Route handlers in `app/api/` translate HTTP requests into typed schema payloads, while service functions in `app/services/` encapsulate database reads and writes. Reporting logic is implemented with aggregate SQL queries rather than client-side recomputation: daily totals, weekly totals, and rolling averages are derived from session data, and day summary rows are upserted for efficient reuse.

On the frontend, `App.tsx` gates private pages and providers on validated authentication. `TimerRuntimeContext` persists counters, offsets, and adjustments in localStorage. The shared API client handles bearer credentials, bounded requests, and locking on HTTP 401. Network failures retain credentials and cached state; mutations are not automatically retried. Browser state is origin-specific and needs a separate transfer at cutover.

## Hosted deployment

The approved stack is Render Static Site + Render Docker Web Service + Neon PostgreSQL. GitHub Actions runs migrations and deploys the exact tested backend commit before the frontend. Free tiers are the initial target, subject to account quotas and cold starts. See [the deployment runbook](docs/deployment.md) for verified progress, environment settings, data preservation and remaining setup. Repository implementation does not mean a hosted deployment has completed.

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
