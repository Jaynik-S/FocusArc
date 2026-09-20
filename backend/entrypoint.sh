#!/bin/sh
set -e

# Local development may migrate; hosted releases migrate separately in CI.
if [ "${APP_ENV:-dev}" = "prod" ] && [ "${RUN_MIGRATIONS:-false}" != "false" ]; then
    echo "Production startup cannot run migrations" >&2
    exit 1
fi
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
python - <<'PY'
import os
import time

import psycopg

database_url = os.environ.get("DATABASE_URL")
if not database_url:
    raise SystemExit("DATABASE_URL is not set")
if database_url.startswith("postgresql+psycopg://"):
    database_url = database_url.replace("postgresql+psycopg://", "postgresql://", 1)

for attempt in range(30):
    try:
        with psycopg.connect(database_url, connect_timeout=3) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        break
    except Exception:
        print("Database not ready; retrying...")
        time.sleep(2)
else:
    raise SystemExit("Database did not become ready in time")
PY
    alembic upgrade head
fi
if [ "$#" -gt 0 ]; then
    exec "$@"
fi
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1 --log-level "${LOG_LEVEL:-info}"
