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

On the backend, `app/main.py` mounts routes under `/api`. Accounts use normalized usernames and Argon2id password hashes stored in PostgreSQL. The API issues a signed, HTTP-only session cookie after login or confirmed registration; private routes derive identity from that validated session rather than browser-supplied identity headers. Existing database users without a password, including `jayy`, can only be initialized through the private admin command.

Persistence is handled with SQLAlchemy models and Alembic migrations. `timers` store per-course metadata such as name, color, icon, archive status, and accumulated cycle totals. `sessions` store the start and end timestamps, computed duration, client timezone, and the derived `day_date` / `day_of_week` values used for reporting. Database constraints enforce important invariants, including unique timer names per user, non-negative durations, and a partial unique index that allows only one active session per user at a time.

The backend code is organized around route modules, schema modules, and service modules. Route handlers in `app/api/` translate HTTP requests into typed schema payloads, while service functions in `app/services/` encapsulate database reads and writes. Reporting logic is implemented with aggregate SQL queries rather than client-side recomputation: daily totals, weekly totals, and rolling averages are derived from session data, and day summary rows are upserted for efficient reuse.

On the frontend, `App.tsx` gates private pages and providers on a validated server session. Unknown usernames require explicit confirmation before public registration; an incorrect password never creates or changes an account. `TimerRuntimeContext` persists counters, offsets, adjustments, selections, and preferences under `coursetimers.accounts.<username>.*` keys. Logout keeps that account's saved browser state while preventing another account from reading it through the app. Network failures retain cached state, and mutations are not automatically retried.

Registration is public: anyone who can reach the site can create a separate account. FocusArc intentionally does not include email verification, password-reset email, or social login.

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

To initialize an existing local user that has no password, set the password in an environment variable so it is not passed as a command argument:

```powershell
$env:FOCUSARC_INITIAL_PASSWORD = Read-Host "Initial password"
docker compose exec -e FOCUSARC_INITIAL_PASSWORD="$env:FOCUSARC_INITIAL_PASSWORD" api python -m app.admin set-initial-password --username jayy
Remove-Item Env:FOCUSARC_INITIAL_PASSWORD
```

The command initializes a null password hash once. Later runs only verify the same password and never overwrite an existing hash.

## Repo Layout

- `backend/`: FastAPI app, SQLAlchemy models, Alembic migrations, and tests
- `frontend/`: React application built with Vite and TypeScript
