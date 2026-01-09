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
