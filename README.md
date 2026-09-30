# FocusArc

## 🎯 About

FocusArc is a **hosted study-time tracker** for organizing work by course. It combines active timers, session history, schedules, and weekly statistics in one focused workspace.

## 🚀 Live link

**Application:** [https://focusarc.onrender.com](https://focusarc.onrender.com)

Create an account or sign in with an existing username and password. Registration is public, and each account has its own timers and study data.

## 📌 Project overview

FocusArc is a full-stack [React](https://react.dev/) and [FastAPI](https://fastapi.tiangolo.com/) application backed by [PostgreSQL](https://www.postgresql.org/). The browser runs as a static single-page application, while a separate API handles authentication, timer operations, reporting, and database access.

```text
Browser
  -> Render Static Site (React/Vite)
  -> Render Docker Web Service (FastAPI)
  -> Neon (PostgreSQL)

GitHub Actions
  -> tests and migration checks
  -> production database migration
  -> backend deployment and health checks
  -> frontend deployment and route checks
```

The hosted services are deployed independently so the frontend remains lightweight and the API can use a reproducible Docker runtime. PostgreSQL data lives outside the application containers, so API rebuilds and restarts do not erase account or timer records.

## ⏱️ Functionality and use cases

- **Course timers:** create, edit, archive, and select course-specific timers.
- **Study sessions:** start, stop, switch, and adjust active sessions.
- **History and schedules:** review recorded sessions by day or week.
- **Progress reports:** track daily totals, weekly totals, averages, and course-level progress.
- **State recovery:** preserve timer display state across refreshes and separate it by account.
- **User accounts:** register and sign in with a username and password, then log out without exposing another account's local state.

Typical uses include tracking study hours across several courses, reviewing how time was distributed during a week, and comparing planned work with recorded sessions.

## 🛠️ Technical details

### 🖥️ Frontend

- [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite 6](https://vite.dev/), and [React Router](https://reactrouter.com/).
- A **responsive single-page interface** with routes for timers, schedules, history, and statistics.
- **Account-scoped browser storage** for timer counters, offsets, selections, and preferences.
- [Vitest](https://vitest.dev/) and [Testing Library](https://testing-library.com/) coverage for authentication, storage isolation, timer recovery, and UI behavior.

### ⚙️ Backend

- [FastAPI](https://fastapi.tiangolo.com/) on [Python 3.11](https://www.python.org/) with [SQLAlchemy](https://www.sqlalchemy.org/) and [Psycopg](https://www.psycopg.org/).
- [Alembic](https://alembic.sqlalchemy.org/) migrations maintain the [PostgreSQL](https://www.postgresql.org/) schema.
- Passwords are stored as **Argon2id hashes**, never as plaintext.
- Authentication uses **signed, secure, HTTP-only session cookies**.
- Private API routes derive the username from the **validated server session**.
- Login and registration include **input validation and rate limiting**.
- PostgreSQL constraints enforce **one active session per account** and other data rules.

### 🗄️ Database model

PostgreSQL stores users, timers, sessions, and day summaries. Timers hold course metadata and accumulated totals; sessions hold timestamps, durations, time zones, and reporting dates. Aggregate SQL queries produce daily and weekly statistics without rebuilding reports entirely in the browser.

## ☁️ Hosting and deployment

- **Frontend:** [Render Static Sites](https://render.com/docs/static-sites) builds the [React](https://react.dev/)/[Vite](https://vite.dev/) app with **Node 22**. SPA rewrites support every frontend route.
- **API:** [Render Web Services](https://render.com/docs/web-services) builds `backend/Dockerfile` and runs [FastAPI](https://fastapi.tiangolo.com/) with HTTPS and `/api/health` monitoring.
- **Database:** [Neon](https://neon.com/) hosts the persistent [PostgreSQL](https://www.postgresql.org/) database, so Render rebuilds do not erase application data.
- **Database connections:** [Psycopg](https://www.psycopg.org/) uses a **restricted pooled role** for the API. Migrations use a separate owner connection.
- **Containers:** [Docker](https://www.docker.com/) keeps the **Python 3.11 environment consistent** across development, CI, and Render. The API container holds no permanent data.
- **Migrations:** [Alembic](https://alembic.sqlalchemy.org/) applies versioned schema changes before each production release.
- **CI/CD:** [GitHub Actions](https://github.com/features/actions) tests the app, rehearses migrations, builds the Docker image, and deploys the **exact tested commit**. It verifies the backend before deploying the frontend.
- **Local development:** [Docker Compose](https://docs.docker.com/compose/) runs PostgreSQL 15, the FastAPI API, and the Vite/Nginx frontend together.

```bash
docker compose up -d --build
```

**Local endpoints:**

- Frontend: `http://localhost:5173`
- API health: `http://localhost:8000/api/health`

## 📁 Repository structure

```text
backend/                 FastAPI API, models, services, tests, and migrations
frontend/                React/Vite application and frontend tests
docker/                  Local PostgreSQL initialization files
scripts/                 Deployment, migration, and smoke-test utilities
.github/workflows/       CI and ordered production deployment
render.yaml              Render infrastructure reference
docker-compose.yml       Local full-stack environment
```
