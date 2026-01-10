# CourseTimers

Local/personal web app to track time spent per course with multiple timers, session history, schedules, and basic analytics.

## Repo layout
- `backend/`: FastAPI + SQLAlchemy + Alembic
- `frontend/`: React + Vite (TypeScript)

## Environment variables
Copy `.env.example` to `.env` and adjust as needed.

- Backend:
  - `POSTGRES_USER=coursetimers`
  - `POSTGRES_PASSWORD=coursetimers`
  - `POSTGRES_DB=coursetimers`
  - `DATABASE_URL=postgresql+psycopg://user:pass@db:5432/coursetimers`
  - `APP_ENV=dev`
  - `CORS_ORIGINS=http://localhost:5173`
  - `LOG_LEVEL=info`
- Frontend:
  - `VITE_API_BASE_URL=http://localhost:8000/api`

## Local dev (Docker)
Run everything with Docker Compose:

```bash
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000/api/health`

## Deployment (Render)
This repo includes a `render.yaml` for a simple Render deployment.

1) Create the services from `render.yaml` in Render.
2) In the `coursetimers-api` service, set `DATABASE_URL` to the Render Postgres connection string.
3) Update `CORS_ORIGINS` to the frontend URL once Render assigns it.
4) Update the frontend `VITE_API_BASE_URL` env var to the API URL (example values are in `render.yaml`).
5) Run DB migrations once per deploy (Render shell on the API service):

```bash
alembic upgrade head
```

Notes:
- The example URLs in `render.yaml` are placeholders; update them after the first deploy.
- If you prefer Fly.io or Railway, mirror the same env vars and run migrations once on deploy.
