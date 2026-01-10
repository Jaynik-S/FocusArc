# FocusArc

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
  - `DATABASE_URL=postgresql+psycopg://coursetimers:coursetimers@db:5432/coursetimers`
  - `APP_ENV=prod`
  - `CORS_ORIGINS=http://localhost:5173`
  - `LOG_LEVEL=info`
- Frontend:
  - `VITE_API_BASE_URL=http://localhost:8000/api`
  - Note: this value is baked in at build time; rebuild the web container if you change it.

## Local Docker (production-like)
Build and start everything:

```bash
docker compose up -d --build
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000/api/health`

View logs:

```bash
docker compose logs -f
```

Run migrations manually (optional):

```bash
docker compose exec api alembic upgrade head
```
