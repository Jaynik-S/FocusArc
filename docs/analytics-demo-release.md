# Analytics: local demo, Neon, and Render

## 1. Run locally (Windows / PowerShell)

From the FocusArc repository root, run Setup once:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/local-demo.ps1 -Action Setup
```

Then run these in **two separate terminals**, also from the repository root:

```powershell
# Terminal A: database and API
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/local-demo.ps1 -Action Api
```

```powershell
# Terminal B: frontend
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/local-demo.ps1 -Action Web
```

Open **[http://localhost:5173/stats](http://localhost:5173/stats)** and sign in:

- Username: **`demo`**
- Password: **`demo12345`** (your approved replacement for `123`; existing password rules are unchanged).

If signed in locally as another user, sign out first. API health: [localhost:8000/api/health](http://localhost:8000/api/health). API docs: [localhost:8000/docs](http://localhost:8000/docs).

### What Setup creates

A separate PostgreSQL 15.19 cluster, database `focusarc_demo`, hashed account credentials, and completed sessions over the preceding 365 days:

| Course | Status |
|---|---|
| MAT237 - Calculus | Active |
| CSC207 - Software Design | Active |
| PHY151 - Mechanics | Active |
| HIS101 - World History | Archived; retained in analytics/history |

The initial October 17, 2026 seed contains **568 completed sessions**, October 17, 2025–October 16, 2026: quiet weeks, morning/afternoon patterns, overnight intervals, manual adjustments, zero-length adjustments, and Toronto DST examples. Counts vary slightly with the setup date. Current timer counters begin at zero; they are separate from historical study totals.

All tools, database files, and logs persist in ignored `.deployment-private/local-demo/`. PostgreSQL listens only on `127.0.0.1:55439`. Setup can be rerun and preserves seeded history and subsequent changes. There is no overwrite/reset option. These launcher processes override inherited hosted URLs, including Alembic's separate migration URL; `.env` files are untouched. The demo generator refuses remote targets.

Docker, administrator privileges, and a Windows service are unnecessary. This workspace's backend environment and Node/npm are ready. On a fresh machine, install Node 22 and [uv](https://docs.astral.sh/uv/getting-started/installation/): Setup can provision Python 3.12 x64 and locked backend packages (omitting Windows-incompatible `uvloop`). It downloads official [EDB PostgreSQL binaries](https://www.enterprisedb.com/download-postgresql-binaries), approximately 315 MB. An existing prepared Python environment can be supplied to Setup/Api using `-PythonPath C:\path\to\venv\Scripts\python.exe`.

Stop API/Web with Ctrl+C in their terminals. Stop PostgreSQL separately:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/local-demo.ps1 -Action Stop
```

Next time, Api automatically starts the existing database. `-Action Database` starts only PostgreSQL. Run all launcher commands as the same Windows account. If ports 55439, 8000, or 5173 are occupied, stop the corresponding existing local process; the launcher does not terminate other applications. Database startup details are in `.deployment-private/local-demo/postgres.log`.

## 2. Demo and test the feature

1. Stats → Overview: switch **3 months → 12 months**. Exact dates, totals, calendar, weekly trend, and hourly activity should update together.
2. Select each course, including archived **HIS101 - World History**.
3. Click a coloured calendar day. History's attributed duration and session count should match the tooltip. Overnight entries show full-session context. Back restores filters.
4. Open an empty day. Try Custom ranges: one day, several weeks, and invalid reversed/future/over-365-day ranges.
5. Inspect hourly peaks and partial weekly points. Recorded totals include adjustments; hourly bars show elapsed activity.
6. Open **Reports** to check the original reports. Ordinary History defaults to today, which initially has no seeded sessions: select yesterday or use a calendar link.
7. Start a timer, wait a few seconds, stop, and revisit Stats. Completed activity appears; running activity does not. Reset Totals preserves history.
8. Check both themes, keyboard arrows/Enter on the calendar, and a 900×700 window.

Frontend checks (separate terminal):

```powershell
Push-Location frontend
npm.cmd test -- --configLoader runner
npm.cmd run build -- --configLoader runner
Pop-Location
```

Backend tests recreate tables: use only the separate disposable **database AND role `focusarc_test`**, never `focusarc_demo`, personal data, or Neon. This test database/role were also provisioned locally during verification; CI provisions its own.

```powershell
$env:APP_ENV = 'dev'
$env:DATABASE_URL = 'postgresql+psycopg://focusarc_test:focusarc_test@127.0.0.1:55439/focusarc_test'
$env:TEST_DATABASE_URL = $env:DATABASE_URL
Push-Location backend
& ..\node_modules\.cache\focusarc-analytics\venv\Scripts\python.exe -m pytest -ra
Pop-Location
```

The Python path above is this workspace's existing environment. Fresh Setup uses `.deployment-private/local-demo/venv/Scripts/python.exe` instead. On another machine, provision a disposable test database separately or use CI; Setup creates only the demo database.

## 3. Neon: verify the database

**This analytics release adds no schema migration.** Alembic head remains `0003_add_password_hash`; existing sessions already contain the needed data. The local demo is not copied to Neon.

1. In the [Neon Console](https://console.neon.tech), select the existing FocusArc project and the branch used by Render. Under **Branches → New branch**, create a pre-release branch, for example `before-advanced-analytics-2026-10-17`, from production's current data. Choose an expiration covering your rollout/rollback period. This preserves an isolated copy without switching the app's connection. See [Neon branch instructions](https://neon.com/docs/manage/branches).
2. In SQL Editor, explicitly select the production branch/database and run:

   ```sql
   SELECT current_database(), current_user;
   SELECT version_num FROM alembic_version;
   SELECT username, password_hash IS NOT NULL AS password_configured
   FROM users WHERE username = 'jayy';
   SELECT count(*) AS sessions,
          count(*) FILTER (WHERE end_at IS NOT NULL) AS completed
   FROM sessions;
   ```

3. If revision is `0003_add_password_hash`, no schema update is needed. If behind, the existing release workflow runs `alembic upgrade head` before deploying. If the revision table is missing or unexpectedly ahead, resolve the mismatch before release; do not recreate tables or manually stamp revisions.
4. Verify GitHub's `production` environment secret **`MIGRATION_DATABASE_URL`** uses the correct branch's **direct owner TLS connection**. Render API **`DATABASE_URL`** stays the **restricted pooled TLS connection**. Obtain these from that branch's Connect dialog; preserve existing credentials. See [Neon pooling documentation](https://neon.com/docs/connect/connection-pooling).

The workflow handles migration checks; no competing manual migration is necessary. Do not import the demo database or point pytest at Neon.

## 4. Render: deploy through the existing workflow

Keep the existing frontend/API services and `.github/workflows/deploy.yml`. Provider setup is described in [deployment.md](deployment.md), which was written for the earlier authentication release; the sequence here applies to analytics.

### Verify settings

| Location | Existing settings |
|---|---|
| Render API | `APP_ENV=prod`, correct pooled Neon `DATABASE_URL`, existing `SESSION_SECRET` (32+ chars), `RUN_MIGRATIONS=false`, exact frontend `CORS_ORIGINS`, `TZ=America/Toronto` |
| Render frontend | `VITE_API_BASE_URL=https://<existing-api-host>/api`, Node 22, root `frontend`, build `npm ci && npm run build`, publish `dist`, SPA rewrite `/*` → `/index.html` |
| GitHub `production` environment secrets | `MIGRATION_DATABASE_URL`, `RENDER_API_KEY`, existing `PRODUCTION_AUTH_PASSWORD` |
| GitHub `production` environment variables | `PRODUCTION_AUTH_USERNAME=jayy`, `RENDER_API_SERVICE_ID`, `RENDER_WEB_SERVICE_ID`, `PRODUCTION_API_URL` (without `/api`), `PRODUCTION_WEB_URL` |

Keep the existing production account/password and session secret. The initializer verifies that password and refuses to overwrite a different hash. `demo12345` is only for local use.

### Commit, test, and release

The actual Deploy workflow handles **both successful main CI and manual dispatch**. With repository variable `PRODUCTION_DEPLOY_ENABLED=true`, successful main pushes can deploy automatically. For the deliberate manual sequence below, set it **false before merging** in GitHub → Settings → Secrets and variables → Actions → Variables. Render service auto-deploys should remain disabled as configured in `render.yaml`.

1. Review, commit, and push the current feature branch:

   ```powershell
   git status --short
   git add backend frontend docs scripts/local-demo.ps1 README.md PRODUCT.md
   git commit -m "Add advanced analytics dashboard and local demo"
   git push -u origin adv-analytics
   ```

   Open/review a PR to main, wait for CI, then merge. Render cannot deploy uncommitted workspace changes. Local database/tools are ignored and excluded.

2. Capture the merged main SHA and wait for CI on that exact commit:

   ```powershell
   git switch main
   git pull --ff-only
   $releaseSha = git rev-parse HEAD
   gh run list --workflow ci.yml --commit $releaseSha
   ```

3. After successful main CI, set `PRODUCTION_DEPLOY_ENABLED=true`, then dispatch:

   ```powershell
   gh workflow run deploy.yml --ref main -f sha=$releaseSha
   gh run list --workflow deploy.yml --limit 5
   gh run watch <run-id>
   ```

   Alternatively: GitHub → Actions → Deploy → Run workflow → main → paste the full 40-character tested SHA. Leaving the flag true permits later successful main pushes to release automatically; return it to false after release if you want manual releases only. See [Render exact-commit deployment](https://render.com/docs/deploys).

4. Confirm ordered success: tested SHA → Neon `alembic upgrade head` → existing production password verification → backend deploy → authenticated API smoke checks → frontend deploy → static route/assets checks. Do not deploy the frontend ahead of the backend. No new migration revision should appear.
5. Open the existing [hosted app](https://focusarc.onrender.com), sign in with your production account, and verify Stats Overview/Reports, filters, calendar → History → Back, and timer completion refresh. Existing production history appears automatically; local demo fixtures do not. Confirm both Render deploys use the same `$releaseSha`, then repeat the Neon revision/count queries.

If a step fails, inspect that GitHub step and Render logs before retrying. Backend smoke failure blocks frontend deployment. To roll back application code, restore both services to the same previously verified commit. These analytics changes are schema-compatible with the prior app; do not delete/downgrade the database or switch to the snapshot without a deliberate restore plan.
