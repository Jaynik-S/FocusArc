#!/bin/sh
set -e

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
        with psycopg.connect(database_url) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        break
    except Exception as exc:
        print(f"Database not ready ({exc}); retrying...")
        time.sleep(2)
else:
    raise SystemExit("Database did not become ready in time")
PY

alembic upgrade head

exec "$@"
