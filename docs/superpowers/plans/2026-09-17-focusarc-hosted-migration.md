# FocusArc Hosted Migration Implementation Plan

> For agentic workers: Execute this plan task by task using the executing-plans skill. Do not deploy or change application code until the user approves implementation. Check off each phase only after its verification gate passes.

**Goal:** Publish FocusArc as a protected personal web application at minimal cost while preserving its React UI, FastAPI service, PostgreSQL records, and local Docker workflow.

**Architecture:** Render Static Site for the Vite build, Render Free Docker Web Service for FastAPI, and Neon Free PostgreSQL. The browser calls the API directly over HTTPS with a personal bearer credential. GitHub Actions tests, applies production migrations, deploys the backend, verifies it, then deploys the frontend.

**Tech stack:** Existing React 18 / Vite 5 / TypeScript, FastAPI, synchronous SQLAlchemy 2, psycopg 3, Alembic, PostgreSQL. Retain Python 3.11 for the backend container; use Node 22 for hosted/frontend builds after verifying the existing lockfile.

**Spec:** User request in this conversation, including the explicit follow-up choice: “Personal app with protected access (recommended).” This document incorporates the requirements and is self-contained.

**Inspection date:** September 17, 2026.
**Inspected checkout:** main, HEAD 0e39f499d914ca03246a8f202a447ae6d3deb693.
**Git remote:** https://github.com/Jaynik-S/FocusArc.git.

## Global constraints

- This session produces a plan only; no application, configuration, dependency, migration, or deployment changes.
- Prefer free hosting, then minimal changes, simple operations, durable PostgreSQL, and reliable HTTPS communication.
- Preserve current screens and behavior except changes necessary for public access and unreliable hosted networks.
- Personal access protection is required before exposing real data.
- Preserve existing records and the local Docker volume. Never run destructive test fixtures against production.
- Do not replace FastAPI, rewrite into Next.js, introduce Supabase client-side data access, or replace PostgreSQL.
- Do not rewrite the historical PLAN.md to match this migration.
- Provider prices and quotas below were researched from official pages; recheck the selected account's dashboard at provisioning.

## Repository inspection and current behavior

The inventory contains 86 files outside Git internals: 84 text files, the npm lockfile, and the favicon. All backend route/service/model/schema modules, migrations, frontend route/hook/context/component modules, build configuration, Docker files, tests, environment examples, styles/asset references, README.md and PLAN.md were read or audited. No CI workflows, cloud deployment manifest, Python dependency lock, uploads directory, background worker, Redis, cron job, WebSocket service, or object-storage integration exists. The IDE-mentioned mig.md is not present on disk in this checkout.

The shell could not launch in this session. Files were read through the available Node file runtime; no application tests, builds, Docker commands, database queries, or provider-account inspection were executed. Dependency versions below are declared or npm-lockfile versions, not a claim about a running installation. The current Docker volume's contents, size, live schema revision, and installed Python dependency versions remain runtime checks for Phase 0.

| Layer | Actual evidence and behavior |
|---|---|
| Frontend | frontend/package.json declares React, React DOM, react-router-dom, Vite, TypeScript and the React Vite plugin. package-lock.json resolves React 18.3.1, react-router-dom 6.30.3, Vite 5.4.21, TypeScript 5.9.3, plugin-react 4.7.0. |
| Frontend build | npm run build executes tsc -b && vite build. The output directory is dist. No frontend automated test script exists. |
| Routing | frontend/src/main.tsx uses BrowserRouter. App.tsx exposes /, /timers, /schedule, /history and /stats; hosting must serve index.html on direct navigation to those paths. |
| API client | frontend/src/api/apiClient.ts concatenates VITE_API_BASE_URL with paths such as /timers. Its fallback is http://localhost:8000/api. It attaches X-Username from localStorage. The URL must include /api, with no trailing slash. |
| Backend | backend/app/main.py exports app = FastAPI(...), configures comma-separated CORS origins and mounts all routes at /api. APP_ENV=prod disables debug. |
| Database | backend/app/db.py uses synchronous create_engine and sessionmaker with psycopg and pool_pre_ping=True. get_db commits successful requests, rolls back errors and closes sessions. |
| Identity | backend/app/auth.py trusts X-Username, trims it, checks length, auto-creates a users row, then sets request.state.username. There is no password, token verification, cookie session or verified identity. |
| Stored records | users, timers, sessions, day_summaries; PostgreSQL UUIDs, timezone-aware timestamps, foreign keys, unique constraints, partial unique index ux_sessions_one_active_per_user, and PostgreSQL ON CONFLICT for summaries. |
| Migrations | 0001_init_schema creates the four tables and indexes; 0002_add_cycle_totals adds timers.cycle_total_seconds. Current source head is 0002_add_cycle_totals. |
| Timer runtime | Browser computes elapsed time each second. Backend stores start/stop timestamps and adjusts duration on requests. No server process must remain continuously alive for a timer to exist. |
| Polling | useActiveSession polls /api/active-session every 15 seconds while enabled, including when no timer is running. A one-second browser interval is local computation, not a one-second API call. |
| Suspension | useActiveSession stores last-active timestamps and tries to stop a session after a browser execution gap longer than five minutes, using the saved client timestamp. Preserve and test this policy. |
| Counter persistence | TimerRuntimeContext stores elapsed counters, offsets and adjustments in localStorage. TimersPage and Sidebar display those values rather than initializing their counters from timers.cycle_total_seconds. Database restore alone does not restore the old browser's dial values. |
| Reset action | EndDayButton actually displays “Reset Totals” and calls POST /api/totals/reset. POST /api/end-day is a separate endpoint. Reset zeroes cycle totals and stops the active session without deleting session history. |
| Reporting | Stats service derives results from sessions. Averages use Python date.today(), so the server OS timezone affects the reporting window. Most session day handling uses the client's IANA timezone. |
| Docker | Compose runs postgres:15, the API container and a built Vite app in Nginx on port 5173. Backend uses python:3.11-slim; frontend build uses node:20-alpine. |
| Initialization | backend/entrypoint.sh waits for PostgreSQL, runs alembic upgrade head, then execs the Uvicorn command. docker/postgres/init.sql is intentionally empty. No seed data is required. |
| Durable storage | PostgreSQL is stored in the local named pgdata volume. API runtime does not store application records in local files. Browser preferences/counters are separate persistence. |
| Tests | backend/tests/conftest.py drops and creates all ORM tables for every test and drops them again afterward. TEST_DATABASE_URL is required or DB-backed tests skip. The test client override currently omits the production commit/rollback lifecycle. Tests do not exercise the Alembic chain. |
| External assets | The favicon is a bundled static asset; styles.css imports IBM Plex Sans and Space Grotesk through HTTPS Google Fonts. No local font-server dependency was found. |

### Hosted-environment assumptions to address

| File(s) | Assumption / consequence | Required treatment |
|---|---|---|
| backend/app/settings.py | Default DB hostname db is Docker-only; default CORS is localhost. | Explicit production DATABASE_URL and HTTPS origins; fail fast when production configuration is missing or still local. |
| .env.example | DATABASE_URL=postgresql+psycopg://replace-me is not usable. Copying it literally overrides working Compose defaults. | Provide a valid documented local example, separate production examples and clear placeholders. |
| frontend/src/api/apiClient.ts; frontend/Dockerfile; docker-compose.yml | Browser API URL defaults to localhost:8000. On a public site that means the visitor's computer. | Require hosted build URL; retain fallback only for local development. |
| frontend/nginx.conf | Nginx supplies SPA fallback locally; a static platform does not read this file. | Configure Render rewrite /* to /index.html with action Rewrite. |
| backend/Dockerfile | Fixed Uvicorn port 8000. | Respect platform PORT with a local fallback of 8000; bind 0.0.0.0. |
| backend/entrypoint.sh | Migration on every process start; no explicit connect timeout. Checked-out file has CRLF bytes. | Production migrations move to CI; bounded startup probe; enforce LF for shell scripts. |
| backend/alembic.ini | Contains placeholder localhost URL. | Actual env.py overrides this; keep it non-secret. Add an explicit migration URL override in env.py. |
| backend/pyproject.toml | Open-ended dependency ranges, no lock, tests in application dependencies. | Add a reproducible Python lock without a framework upgrade; removing test packages from production is optional, not a prerequisite. |
| backend/app/settings.py and Docker command | LOG_LEVEL is defined but not wired into Uvicorn's command. | Pass it explicitly. |
| localStorage users/counters/preferences | Storage belongs to a browser origin and does not move from localhost to onrender.com. | Provide a deliberate one-time state export/import procedure and test on a new origin. |
| backend/app/services/stats.py | date.today() depends on host timezone. | Set the personal reporting TZ explicitly to America/Toronto; keep UTC timestamps. |
| backend/tests/conftest.py | Destructive fixtures and no Alembic verification. | Use only disposable PostgreSQL; add migration and cross-request persistence checks. |
| .gitignore | Ignores .env only, not all environment variants or backups. | Ignore .env.*, preserve example files, ignore private database dumps/browser exports. |

## 1. Recommended Production Architecture

Use two hosting providers:

1. Render Static Site named focusarc-web (or the assigned unique variant), built from frontend/.
2. Render Docker Web Service named focusarc-api, using the existing backend image structure.
3. Neon Free project focusarc, with PostgreSQL 15 when offered; otherwise select the nearest supported newer major version and prove compatibility in migration rehearsal.
4. GitHub Actions on main owns the deployment sequence. Disable independent Render commit-triggered deployment to prevent application rollout racing database migrations.

Suggested regions: Render Ohio and Neon AWS us-east-2 if both are offered to the account. If not, choose the closest supported US East pair before provisioning. Region matching reduces latency but is not private networking: backend-to-Neon traffic uses a public TLS connection.

    Browser
      |-- HTTPS --> Render CDN: React/Vite static files
      |
      |-- HTTPS + Authorization: Bearer <personal access key>
      |            --> Render: FastAPI /api/*
      |                       --> Neon pooled TLS connection
      |
    GitHub Actions
      |-- tests against disposable PostgreSQL
      |-- Alembic through Neon direct TLS connection
      |-- deploy exact tested backend commit; verify
      |-- deploy exact tested frontend commit; verify

Use platform subdomains initially. A custom domain is optional and separately billed by its registrar.

Use direct cross-origin API requests for this first migration. No proxy, cookie domain work, reverse-proxy rewrite, custom domain or extra edge worker is required. Configure CORS precisely.

### Personal access contract

The static application shell may be publicly downloadable; personal data and actions must be protected at the API, including the API's own onrender.com URL.

- Generate a random key using Python secrets.token_urlsafe(32); this is an entropy-rich personal access key, not a memorable password.
- Store its SHA-256 digest as PERSONAL_ACCESS_KEY_SHA256 on the backend and the original key in the owner's password manager.
- Production get_username authenticates Authorization: Bearer before reading/creating user records, and uses OWNER_USERNAME from backend configuration as the authoritative identity.
- A supplied different X-Username receives 403; an omitted X-Username is acceptable in personal mode. Knowing any username is insufficient.
- Missing/invalid bearer key returns 401 with a generic response and performs no database writes.
- Keep the existing username gate layout; add a password-type “Access key” field for personal mode. Validate via GET /api/me before entering the app.
- Keep the entered key in sessionStorage for this minimal personal deployment. It survives refresh in the tab; browser session restore may also restore it. It is accessible to same-origin JavaScript, so it is not equivalent to an HttpOnly cookie. Never store it in localStorage, source, a URL, logs, or a VITE_* variable.
- Provide a small “Lock” action that clears the credential and unmounts private in-memory screens; it does not stop a server timer, delete database records or erase local timer counters. Logout state must be reactive so hooks stop making authenticated calls. Browser-local counters remain on this personal device and are loaded only after successful authentication as the same owner; they are not encrypted at rest.
- All protected screens, Sidebar loading and TimerRuntimeProvider must depend on authenticated session state, not just the existence of a saved username.
- A 401 clears authentication and returns to the gate. Network errors/503 do not clear credentials or erase cached state.
- Local username-only behavior is allowed only with APP_ENV=dev and AUTH_MODE=local. APP_ENV=prod must require AUTH_MODE=personal, OWNER_USERNAME and a valid digest.
- No account registration, email integration, OAuth, user schema replacement or new auth table is needed.
- Keep /api/health public; disable production /docs, /redoc and /openapi.json, while retaining them locally.

## 2. Why This Architecture

The existing backend fits a conventional PaaS well: an importable ASGI app, short request/response operations, external SQL storage, no persistent uploads, no background scheduler and no requirement for sticky sessions. Render can use its existing Docker packaging; the frontend is already a static build. Neon preserves actual PostgreSQL semantics used by the ORM and migrations.

Render static hosting provides Git integration, SPA rewrites, CDN delivery and managed HTTPS. Keeping both application services there avoids introducing a third hosting dashboard solely for static assets. [Render Static Sites](https://render.com/docs/static-sites)

| Architecture | Suitability for this repository | Decision |
|---|---|---|
| Render static frontend + Render Docker API + Neon | Existing frontend/backend packaging fits; two providers; durable independent PostgreSQL; free entry point. | Recommended. |
| Vercel frontend + Render API + Neon | Equally feasible technically. Set frontend root, dist output, SPA fallback and public API URL. Adds a third provider without a repository-specific feature gain. | Good alternate if the user prefers Vercel's frontend workflow. |
| Vercel frontend + Vercel FastAPI + Neon | FastAPI is now supported directly. backend/app/main.py is a supported entrypoint with project root backend. No need to rewrite the API into JavaScript. Requires serverless-specific packaging verification, bounded connection pools, external migration execution and usage monitoring. | Viable second choice; benchmark if Render wake-up delay becomes unacceptable. |
| Render frontend/API + Render Free PostgreSQL | Easy integration, but the free database expires after 30 days. | Reject for durable free data. |
| Railway API + Railway PostgreSQL, with static frontend elsewhere | Docker and PostgreSQL fit. Database is a deployed database service with volume/backup operations to manage, not an excuse to skip backups. CPU, RAM, volume and network usage consume credits. | Paid convenience option; recurring free allowance is too small to budget a continuously available API and database with confidence. |
| Render API + Supabase PostgreSQL | Existing ORM can use it as PostgreSQL. No need to replace models with Supabase SDKs. Auth/storage features are unnecessary for this personal-key plan. | Feasible; Neon better matches this narrow database-only requirement. |
| Cloudflare Pages frontend + Render API + Neon | Static Vite frontend fits; current free Pages allowance is 500 builds/month. | Another capable frontend substitute, but another provider. Moving the existing psycopg backend into an edge runtime is outside this minimal migration. |
| One Render web service serving frontend and backend | Requires adding static serving and combined builds; saves no paid web instance compared with a free static site. The whole UI would wait during API wake-up. | No advantage here. |

Current Vercel documentation explicitly supports FastAPI and lists app/main.py as an entrypoint; the app becomes one Python function. Function duration/bundle/resource rules apply, and the normal Docker entrypoint is not the migration lifecycle. Do not use outdated claims that Vercel cannot run FastAPI or always requires a rewrite. [Vercel FastAPI](https://vercel.com/docs/frameworks/backend/fastapi), [function limits](https://vercel.com/docs/functions/limitations)

Vercel Hobby is for personal, non-commercial use, which matches the user's current choice. It would need reassessment for a commercial application. [Vercel Hobby](https://vercel.com/docs/plans/hobby)

Supabase Free currently includes a 500 MB database, 5 GB egress and two active projects, with inactivity pausing after a week. Direct endpoints are IPv6; its shared session pooler offers IPv4 and is the appropriate fallback for compatible long-lived/migration connections. [Supabase pricing](https://supabase.com/pricing), [connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres)

Cloudflare is a valid static alternative, not needed in the chosen topology. [Pages limits](https://developers.cloudflare.com/pages/platform/limits/)

## 3. Expected Hosting Cost

Prices are USD before taxes; these are conditional budgets, not uptime guarantees.

| Item | Initial cost | Relevant constraint |
|---|---:|---|
| Render static site | $0 | Shared workspace bandwidth/build allowances. |
| Render Free API | $0 | 512 MB; idle spin-down; shared free-instance allowance. |
| Neon Free PostgreSQL | $0 | 0.5 GB per project; 100 CU-hours/month/project; 5 GB public transfer; scale-to-zero. |
| GitHub Actions | $0 within account allowance | Standard hosted runners are free for public repositories; private repository allowance depends on account plan. |
| Platform HTTPS URLs | $0 | No custom domain required. |
| Total for modest personal use | $0/month | All quotas must remain within allowances. |
| More predictable API availability | Approximately $7/month plus any other usage | Upgrade Render to its 512 MB paid web instance; keep static site and Neon Free initially. |

Render Free sleeps after 15 minutes without incoming traffic, may take about a minute to resume, and offers 750 free instance-hours per workspace per month. Its filesystem is ephemeral; free web services lack shell access, one-off jobs and persistent disks. External-database traffic is also subject to its service-initiated traffic policy. Free PostgreSQL expires after 30 days. [Render Free](https://render.com/docs/free)

Render's current pricing lists the 512 MB paid web instance at $7/month; current Blueprint identifier is 0.5c-512mb. Inspect account pricing rather than relying on the older Starter label. [Render pricing](https://render.com/pricing), [Blueprint specification](https://render.com/docs/blueprint-spec)

Neon Free has no 30-day trial expiry, but storage, compute, transfer and a short restore window remain limits. Its listed restore window is up to six hours or 1 GB of changes; use independent backups. [Neon pricing](https://neon.com/pricing)

Usage implication from this repository: polling every 15 seconds is 240 requests/hour/tab. At an assumed 0.25 CU, eight active hours/day for 30 days is about 60 CU-hours plus wake-up tails and other work; continuous 30-day activity is about 180 CU-hours and exceeds 100. These are estimates, not measured usage. Leaving the app open can keep both services active. Disable polling on hidden tabs, keep foreground behavior, and do not add artificial keep-alive traffic.

Railway now has a recurring free allowance: $5 trial credit for 30 days, followed by $1/month of free resource credit. Hobby has a $5 monthly minimum including $5 usage; actual usage above that costs extra. Do not describe it as either unlimited free hosting or trial-only. [Railway pricing](https://railway.com/pricing)

GitHub Actions billing and allowances are account-specific; keep artifacts short-lived and runs on Linux. [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

## 4. Repository Changes Required

These are planned changes only.

| Action | Files | Purpose |
|---|---|---|
| Modify | backend/app/settings.py | Production validation, personal auth settings, migration URL override and explicit DB-pool/timeouts. |
| Modify | backend/app/auth.py | Verify bearer access before database access and map authenticated access to the configured owner. |
| Modify | backend/app/main.py | Exact CORS policy, disable public API docs in production, no-store API response policy. |
| Modify | backend/app/api/router.py | Keep liveness endpoint; add authenticated readiness check without leaking connection errors. |
| Modify | backend/app/db.py | Small bounded pool, bounded connect timeout; retain commit/rollback/close semantics. |
| Modify | backend/alembic/env.py | Prefer MIGRATION_DATABASE_URL; retain DATABASE_URL fallback and NullPool. |
| Modify | backend/entrypoint.sh, backend/Dockerfile | Optional migrations, dynamic PORT, LOG_LEVEL, bounded probe, LF shell execution and reproducible installation. |
| Create | backend/requirements.lock | Exact tested transitive Python versions for Linux/Python 3.11. |
| Modify | backend/pyproject.toml if necessary | Add tzdata for explicit portable IANA timezone support; constrain only compatibility fixes demonstrated by verification. |
| Create | .gitattributes, backend/.dockerignore, frontend/.dockerignore | LF shell scripts; exclude secrets, local dependencies, caches and dumps from build contexts. |
| Modify | .gitignore, .env.example, docker-compose.yml | Safe secret examples, local auth defaults and explicit local migration behavior. Keep pgdata and PostgreSQL 15. |
| Create | backend/.env.example, frontend/.env.example | Explain backend runtime settings and frontend build-time public values for non-Compose development. |
| Modify | frontend/src/api/apiClient.ts, frontend/vite.config.ts, frontend/src/vite-env.d.ts | Validate hosted API URL, bearer header, typed auth/network errors, abort timeout, strict JSON and public config typing. |
| Create | frontend/src/context/AuthContext.tsx | Reactive personal authentication state with sessionStorage credential and gated loading of existing local caches. |
| Modify | frontend/src/App.tsx, frontend/src/routes/UsernameGate.tsx, frontend/src/components/MainLayout.tsx, frontend/src/components/Sidebar.tsx, frontend/src/context/TimerRuntimeContext.tsx | Protect route/data loading, add key entry and lock action, stop unauthorized polling and remount private runtime state after authentication. |
| Modify | frontend/src/hooks/useActiveSession.ts | One in-flight poll, caught failures, bounded retry/backoff, visibility-aware network polling. |
| Modify | frontend/Dockerfile | Match hosted Node 22 and propagate the public auth-mode build argument; preserve local Nginx serving. |
| Create | render.yaml | Two Render services, static rewrite, free API plan explicitly set, no Render database, auto-deploy off. |
| Create | .github/workflows/ci.yml, .github/workflows/deploy.yml | Isolated tests plus a serialized production migration/deployment workflow. |
| Create | scripts/deploy_render.py | Deploy a specified commit and wait for that deployment's terminal state using Render's API. |
| Modify/create | backend/tests/conftest.py; backend/tests/test_auth.py; backend/tests/test_deployment.py | Correct transactional fixture and focused auth/config/readiness/CORS/persistence checks. |
| Create | docs/deployment.md | Provisioning, environment setup, data/browser-state transfer, verification, rollback and backup runbook. |
| Modify | README.md | Hosted architecture, truthful auth description, links to runbook and accurate local commands. |

No new schema migration is expected just to change hosts or add single-owner bearer access. Keep both existing migrations intact unless rehearsal proves an actual incompatibility. No timer/service/UI redesign is included.

## 5. Step-by-Step Migration Phases

### Phase 0 — Establish a reproducible baseline and preservation inventory

**Why:** Live data and baseline behavior were not observable from static inspection.

**Files:** Read all configuration above; create initial docs/deployment.md notes during implementation. No application behavior changes yet.

- [ ] Record git status and current commit; preserve unrelated working changes.
- [ ] Run docker compose config with sensitive output kept private; verify which actual DATABASE_URL is in use.
- [ ] Inspect docker compose ps and logs; record PostgreSQL server version, current database size, table row counts, user names, active sessions and alembic current.
- [ ] Record the owner's exact existing username, preserving case; use it later as OWNER_USERNAME.
- [ ] Stop active timers through the existing UI, record the visible counters and export browser storage as described in Phase 4 before changing the origin.
- [ ] Build the existing frontend with npm ci then npm run build. Record Node version.
- [ ] Reproduce backend tests on a disposable PostgreSQL database only. Note skipped tests as unverified, not success.
- [ ] Inspect the current dependency environment if available, so the lock starts from a demonstrated working baseline.
- [ ] Preserve the current Docker volume and make a private logical backup.

**Gate:** Baseline app behavior documented, recoverable backup available, unrelated working changes known, and any baseline failures separated from migration work.

### Phase 1 — Add protected personal access

**Why:** A username header currently gives arbitrary access to personal data.

**Files:** backend/app/auth.py, settings.py, main.py; frontend auth context, API client, gate, App, MainLayout, Sidebar and TimerRuntimeContext; backend/tests/test_auth.py.

- [ ] Define AUTH_MODE=personal|local, OWNER_USERNAME and PERSONAL_ACCESS_KEY_SHA256. Production rejects local mode and missing/invalid owner/digest.
- [ ] Introduce require_access without database dependencies. Use hashlib.sha256 and hmac.compare_digest to compare the entered high-entropy key's digest. Do not log credentials.
- [ ] Apply access verification to every data route before the username lookup and any auto-creation. Retain get_username as the route integration point and request.state.username for services.
- [ ] Reject conflicting supplied X-Username in personal mode. Keep existing username behavior only in explicit local dev mode.
- [ ] Implement AuthContext with authenticated state, loading state, authenticate(username, key), and lock(). Store the personal key only under focusarc.accessKey in sessionStorage.
- [ ] Validate stored credentials on startup through /api/me before mounting private data loaders. Validate new credentials before navigating away from the gate.
- [ ] Add VITE_AUTH_MODE=personal for hosted builds and local for local builds. It controls the visible gate only; it cannot weaken backend protection.
- [ ] On lock or 401, clear focusarc.accessKey, stop polling and unmount private data contexts. Retain the existing coursetimers.* persistent counters/preferences so locking does not lose accumulated dial totals. Restore caches only after /api/me confirms the same owner. If the configured owner changes, explicitly export/clear the previous owner caches before loading another owner. The personal device retains unencrypted local data; locking protects server access and screen display, not inspection of browser storage.
- [ ] Add a Lock control using existing button styles; gate error/loading text uses existing styling. Keep all timer controls and screen layouts.
- [ ] Disable production OpenAPI/docs endpoints; keep public health.
- [ ] Add focused checks: missing key 401; wrong key 401; no user row created on either; valid key returns owner; conflicting username 403; every route group protected; direct API origin cannot bypass authentication; local-mode regression.

**Gate:** Raw HTTP requests cannot access or mutate data with only X-Username; refresh/login/lock/401 behave correctly without a full page reload or stale cached private screens.

### Phase 2 — Make configuration, startup and builds portable

**Why:** Hosted builds cannot use Docker DNS, Windows shell newlines or unchecked defaults.

**Files:** settings.py, db.py, main.py, router.py, Dockerfile, entrypoint.sh, pyproject.toml/requirements.lock, env examples, ignore files and .gitattributes.

- [ ] Validate explicit production DATABASE_URL and CORS_ORIGINS. Reject missing production values and obvious local DB hosts; require HTTPS CORS origins for production.
- [ ] Normalize postgresql:// or postgres:// provider URLs to postgresql+psycopg:// using SQLAlchemy URL parsing, preserving encoded credentials and SSL query parameters. Do not install psycopg2 just to accommodate a URL default.
- [ ] Keep pool_pre_ping=True. Configure pool_size=2, max_overflow=3, pool_timeout=15 and psycopg connect_timeout=10 as initial defaults; one Uvicorn worker. Keep them small and configurable, not tied to frontend tab counts.
- [ ] Keep get_db's successful commit, error rollback and close. Do not mask database failures as empty successful results.
- [ ] Keep GET /api/health returning 200 JSON without a database query. Use it for Render health checks.
- [ ] Add GET /api/ready protected by require_access; execute SELECT 1 and check that alembic_version is readable. Return generic 503 on DB/schema failure and log a redacted diagnosis. Use this for release checks, not periodic uptime pings.
- [ ] Define RUN_MIGRATIONS=true for local containers; false for production. entrypoint waits with bounded attempts and per-connection timeout; only runs Alembic when enabled.
- [ ] Default entrypoint command becomes Uvicorn app.main:app --host 0.0.0.0 with port from PORT (fallback 8000), one worker and LOG_LEVEL (fallback info). Preserve explicit command overrides.
- [ ] Use exec for the final server process so SIGTERM is handled. Do not use reload in production.
- [ ] Normalize entrypoint.sh to LF and add *.sh text eol=lf in .gitattributes.
- [ ] Add a Linux/Python 3.11 dependency lock and install it consistently in CI and the Dockerfile, then install the local package with --no-deps. Preserve application package discovery.
- [ ] Ensure ZoneInfo has IANA data using tzdata when necessary. Set TZ=America/Toronto for the personal backend to make date.today() deterministic relative to the user's reporting day.
- [ ] Set CORS allow_credentials=False because this plan uses an explicit bearer header, not cookies. Allow only listed origins; methods GET, POST, PATCH, DELETE and preflight; headers Authorization, Content-Type and X-Username. Add a preflight max_age of 600.
- [ ] Send Cache-Control: no-store on private API responses. Never cache user API JSON on a CDN.
- [ ] Update .gitignore to cover .env.* while unignoring .env.example and nested example files; ignore backups/ and exported private data. Exclude the same from Docker contexts.
- [ ] Verify Node 22 with the existing package lock, then align frontend Docker build to Node 22. No React/Vite major upgrade is required by the hosting strategy.

**Gate:** Container starts on an injected non-8000 PORT, stops cleanly, refuses incomplete production config, has working timezone data and never migrates when RUN_MIGRATIONS=false. Missing DB still produces a live process/clear startup failure as designed, never a misleading successful readiness check.

### Phase 3 — Provision Neon and rehearse Alembic

**Why:** Managed persistent PostgreSQL replaces pgdata in production while preserving schema semantics.

**Files:** backend/alembic/env.py, settings.py; deployment documentation. Existing revision files remain intact.

- [ ] Create a free Neon project near the selected API region; select PostgreSQL 15 if available.
- [ ] Create/identify the production database and migration-owner role. Create a separate application role with CONNECT, schema USAGE and required DML on users, timers, sessions and day_summaries; SELECT on alembic_version.
- [ ] Remove unnecessary schema-creation rights from the application role. Set migration-owner default privileges for future application tables. UUIDs are generated in Python, so no new UUID extension is needed.
- [ ] Record two SQLAlchemy URLs privately: pooled endpoint for app runtime and direct endpoint for migrations, dump and restore. Require TLS and preserve provider-generated options; prefer verified-host TLS where supported by the supplied CA configuration.
- [ ] Modify env.py get_url to prefer MIGRATION_DATABASE_URL, then fall back to DATABASE_URL. Preserve NullPool; avoid putting real URLs into alembic.ini.
- [ ] Create a disposable rehearsal database/branch with different credentials from production.
- [ ] On an empty rehearsal DB, from backend run alembic upgrade head, alembic current, alembic heads and alembic upgrade head again.
- [ ] Confirm users/timers/sessions/day_summaries and the partial unique active-session index exist; verify cycle_total_seconds and foreign keys.
- [ ] Compare migrated schema with ORM expectations. If constraint naming differs because of naming conventions, determine whether it is cosmetic before changing a historical migration.
- [ ] Verify the runtime application role can create a timer and commit a session, but cannot create/drop schema objects.
- [ ] Test idle resume through the pooled URL, including repeated transaction use. Preserve normal protocol-level prepared statement behavior unless a reproduced driver/pooler compatibility issue calls for prepare_threshold=None.

**Gate:** Fresh migrations succeed twice with one head; ORM works against the migrated schema through the restricted runtime role; direct backup/restore connection works. No production data has been overwritten.

Neon recommends pooled connections for ordinary web traffic and direct connections for migrations and pg_dump/pg_restore. Its pool uses transaction mode, so avoid session-level assumptions on the runtime pool. [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)

### Phase 4 — Rehearse and perform data/browser-state transfer

**Why:** The database and the visible local timer counters are separate persistence sources.

**Files:** docs/deployment.md only; backups stay outside Git.

- [ ] Rehearse the full restore into the disposable Neon database before the final cutover.
- [ ] Stop local timers through the UI and stop local API/web writes during final export. Keep the database running for pg_dump.
- [ ] Use pg_dump custom format against the actual source database, including schema, data and alembic_version. Use a PostgreSQL client matching the source major or compatible newer version.
- [ ] For Windows, write the archive to a file inside the DB container and copy it using docker cp; avoid piping binary custom archives through PowerShell text redirection.
- [ ] Generic local template: docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/focusarc.dump', then docker compose cp db:/tmp/focusarc.dump ./backups/focusarc.dump. Use a private protected backups directory.
- [ ] Restore to an EMPTY target database via pg_restore --no-owner --no-acl --exit-on-error --single-transaction using the direct Neon connection. Do not apply schema migrations to that empty destination first and then restore the same schema on top.
- [ ] After restore, run alembic current and alembic upgrade head to apply only revisions newer than the imported version. Reapply runtime-role grants/default privileges.
- [ ] If there is truly no source data, skip restore and use alembic upgrade head on an empty production DB. No application seed command is needed; the owner is created only on successful authenticated access.
- [ ] If source lacks alembic_version or disagrees with source models, stop and inspect schema. Never blindly stamp head to silence an error.
- [ ] Compare row counts for all four tables, IDs, owner strings, date ranges, timestamps, sum(duration_seconds), cycle_total_seconds and no-more-than-one-active-session invariants.
- [ ] Export only the known existing coursetimers.* keys from the old origin after pausing timers: username, timers, activeSession, lastActiveAt, timerElapsed, timerOffsets, sessionAdjustments, selectedTimerId and theme. Do not use localStorage.clear() or export unrelated origin data.
- [ ] On the hosted origin, authenticate successfully, close competing tabs, import the vetted keys for the same owner and timer IDs, then refresh. Never copy a personal key into that export. A stopped-session export should not resurrect an active session.
- [ ] Compare hosted visible dial/sidebar counters to the captured local values. Preserve server records as authoritative for history/stats and do not recompute or double-apply local offsets during import.
- [ ] Document that future devices/new origins do not automatically inherit dial counters/preferences; that is existing behavior. Automatic cross-device counter reconciliation is a separate feature and is not included in this host migration.
- [ ] Retain the original pgdata volume and backup until hosted use and restore rehearsal have passed.

**Gate:** Restored database matches the source, exact owner identity is preserved, and the new-origin UI matches recorded counters after deliberate browser-state import. Never run pytest against this target.

### Phase 5 — Prepare frontend for hosted API behavior

**Why:** Cold starts and public-origin configuration expose cases hidden by localhost latency.

**Files:** apiClient.ts, useActiveSession.ts, vite.config.ts, vite-env.d.ts, frontend env example and Dockerfile.

- [ ] Production frontend build requires a valid HTTPS VITE_API_BASE_URL ending in /api with no trailing slash. Localhost fallback is allowed only in local mode.
- [ ] Keep all endpoint paths and response types unchanged. The hosted browser must request https://<assigned-api-host>/api/timers, never db, api:8000 or localhost.
- [ ] apiFetch adds bearer credentials from AuthContext's storage helper and uses AbortController with a 90-second first-request timeout suitable for Render wake-up; ensure callers can still supply cancellation.
- [ ] Reject successful non-JSON API responses as a controlled connectivity error except existing 204 handling. This prevents a host loading/HTML error page being mistaken for a typed API object.
- [ ] Catch scheduled refresh failures, preserve the last confirmed active session, and show a concise reconnecting state through existing error/loading patterns.
- [ ] Allow at most one refresh in flight. Use a completion-based polling loop and bounded backoff after read failures; no queued 15-second overlaps during a one-minute wake-up.
- [ ] Suspend network polling while document.hidden and perform a refresh when visible again. Preserve the local timer tick and existing five-minute suspension policy; do not reset lastActiveAt in a way that suppresses the existing auto-stop behavior.
- [ ] On 401 lock the auth state; on 503/timeout keep credentials and cached state. Never blindly retry POST/PATCH/DELETE operations; reconcile via a read because a timed-out write may have committed.
- [ ] Keep confirmed stop/reset/start UI behavior; add only necessary connection feedback, not a redesigned screen.

**Gate:** Build fails for missing hosted API config; first load after >15 minutes idle recovers; there are no unhandled promise rejections or overlapping polls; reconnect does not duplicate a start/reset; existing suspension and time-adjustment behavior remains intact.

### Phase 6 — Configure Render services

**Why:** Repeatable hosting configuration replaces implicit Compose networking.

**Files:** render.yaml, docs/deployment.md.

- [ ] Define a Docker web service with type web, runtime docker, plan free explicitly, region ohio, branch main, dockerContext ./backend and dockerfilePath ./backend/Dockerfile. Keep repository root as context for resolving those manifest paths.
- [ ] Do not define a Render PostgreSQL database, disk, cron or paid pre-deploy command.
- [ ] Backend uses Dockerfile build/start; port comes from PORT. Set healthCheckPath=/api/health and autoDeployTrigger=off.
- [ ] Define static frontend with type web, runtime static, rootDir frontend, buildCommand npm ci && npm run build, staticPublishPath dist, branch main and autoDeployTrigger=off.
- [ ] Do not set plan on the static site; Render's current schema does not support a compute plan for static sites.
- [ ] Set NODE_VERSION=22, SKIP_INSTALL_DEPS=true, VITE_AUTH_MODE=personal and the assigned public API URL for the static build.
- [ ] Add a rewrite from /* to /index.html with action rewrite. Assets should continue to resolve normally; do not use a 301/302 redirect as the SPA fallback.
- [ ] Set production backend secrets privately in Render; secret manifest entries use sync:false, never literal credentials.
- [ ] Set CORS_ORIGINS to the actual static site's HTTPS origin, without path or trailing slash. Add a custom frontend domain only if configured later; do not wildcard every onrender.com or vercel.app host.
- [ ] Use the assigned provider URLs after provisioning; the example service names are not promises of hostname availability.
- [ ] Keep automatic previews disabled initially. Any later preview API must use isolated disposable data and explicitly allowed frontend origins.
- [ ] Validate the Blueprint against Render's current schema before creating resources. Ensure its first deployment contains the access-protection code and all required secrets.

**Gate:** Backend health works over HTTPS, unauthenticated data routes return 401, authenticated readiness works, static deep links refresh successfully and assets load. The application role alone is present on the running API; the migration-owner URL is not.

Render supports PORT-based HTTP services and managed deployment health checks. [Web services](https://render.com/docs/web-services)
Configuration fields and path semantics must follow the current schema. [Blueprint reference](https://render.com/docs/blueprint-spec)

### Phase 7 — Implement isolated CI and ordered automatic deployment

**Why:** Production schema changes must not race frontend/backend releases or require a paid Render pre-deploy feature.

**Files:** .github/workflows/ci.yml, .github/workflows/deploy.yml, scripts/deploy_render.py, backend tests/conftest.py and focused deployment tests.

- [ ] CI runs on pull_request and push to main using Linux, Python 3.11, Node 22 and a disposable PostgreSQL 15 service.
- [ ] Install the Python lock and local package consistently; run npm ci and npm run build with non-secret validation env values.
- [ ] Set DATABASE_URL and TEST_DATABASE_URL to the disposable DB. Fix the client fixture override to use production-equivalent commit/rollback/close behavior.
- [ ] Add a separate migration check on a separate disposable database: empty DB -> upgrade head -> repeat upgrade -> verify expected indexes and version. ORM create_all tests cannot substitute for this.
- [ ] Run all existing backend tests plus authentication/config/CORS/readiness checks. Add a start-then-GET check across separate HTTP requests to verify commit durability.
- [ ] Ensure non-skipped test counts are reported. Add a safeguard that rejects test targets not explicitly named as disposable test databases.
- [ ] Build the backend Docker image once as a CI check so Linux shell/packaging failures are detected before deployment.
- [ ] Production deploy workflow runs only for a successful CI run on main from this repository, or a deliberate workflow_dispatch of an already tested main commit. Check out that exact SHA, not moving main.
- [ ] For workflow_run, verify event, repository, branch and conclusion before exposing secrets; never run production code from a fork PR or pull_request_target checkout.
- [ ] Put migrations and deployments in one production concurrency group with cancel-in-progress=false. Superseded queued commits may be skipped, but an active migration/release must not be cancelled mid-step.
- [ ] In the migration job set MIGRATION_DATABASE_URL to the secret direct owner URL and DATABASE_URL to the same URL for settings compatibility. APP_ENV=dev is acceptable in this non-serving migration process; no web server or auth bypass is exposed.
- [ ] Run alembic upgrade head then alembic current from backend. Record revision and SHA without printing the URL. Migration failure prevents both deploys.
- [ ] scripts/deploy_render.py uses standard-library HTTP/JSON, RENDER_API_KEY and a service ID. POST /v1/services/{serviceId}/deploys with commitId=<tested SHA>, capture deploy ID, poll GET /v1/services/{serviceId}/deploys/{deployId} every 10 seconds, honor rate-limit responses and fail after a bounded 20-minute wait.
- [ ] Check the returned deployment's commit and live status. Do not accept an old /api/health response as proof the new backend deployed.
- [ ] Deploy backend first. Then verify /api/health, authenticated /api/ready and /api/me, and that current Alembic revision equals the checked-out source head.
- [ ] Deploy frontend at the same SHA only after backend checks pass; wait for that static deploy ID to become live.
- [ ] Run read-only production smoke checks and confirm /timers, /history, /schedule and /stats return the SPA with correct asset responses.
- [ ] Keep direct Render auto-deploy off. Do not add deploy hooks as a second parallel deployment mechanism.
- [ ] Restrict production secrets to the production workflow/environment. Review account support for branch protections/environment restrictions and configure available controls.

**Gate:** Failed CI prevents release; failed migration prevents release; failed backend deploy prevents frontend rollout; successful main merge deploys the exact tested commit in order. The running API never has migration-owner credentials.

Free Render does not provide the normal paid web-service pre-deploy command. This plan runs migration explicitly in GitHub Actions instead. [Render deployment lifecycle](https://render.com/docs/deploys)
The API supports deployment of a specified commit and retrieval of that deployment's status. [Trigger deploy](https://api-docs.render.com/reference/create-deploy), [retrieve deploy](https://api-docs.render.com/reference/retrieve-deploy)

### Phase 8 — End-to-end acceptance and final cutover

**Why:** Successful individual deploys do not prove browser/API/database integration.

**Files:** Verification notes in docs/deployment.md; only targeted fixes if a migration-specific failure is reproduced.

- [ ] Rehearse full timer mutations on the disposable hosted rehearsal database; on production use one clearly identified temporary timer only with the owner's awareness.
- [ ] Confirm key entry, refresh, incorrect key, lock and re-entry from an incognito browser.
- [ ] Create, rename and archive a timer; verify duplicate-name 409.
- [ ] Start A, switch to B, stop B, refresh, and verify one-active-session constraint and persisted history.
- [ ] Verify +5 min, -10 min, negative-duration clamp, reset totals preserving history, and active-session recovery.
- [ ] Verify day schedule, date-filtered history, daily/weekly totals and rolling averages against known DB results.
- [ ] Test /api/end-day separately because it is not the current reset button.
- [ ] Test America/Toronto midnight and DST cases, and the five-minute browser suspension policy.
- [ ] Restart/redeploy the backend and prove data remains; close all app tabs long enough for idle suspension and verify the next load.
- [ ] Test narrow/wide layouts, light/dark themes, favicon/fonts and all direct route refreshes.
- [ ] Inspect DevTools for HTTPS-only requests, correct /api prefix, correct CORS and no credentials embedded in downloaded bundles.
- [ ] Finish the final stop/export/restore/browser-state transfer from Phase 4, then use only the hosted copy for real writes.
- [ ] Keep local API/web stopped against the old production snapshot; future local development gets its own database. Do not allow both old and new databases to become independent live sources.

**Gate:** Every acceptance item passes or a documented pre-existing limitation is explicitly accepted. No unexplained row-count or duration differences remain.

### Phase 9 — Backups, rollback and documentation

**Why:** Free persistence still needs recovery and operational instructions.

**Files:** docs/deployment.md, README.md.

- [ ] Document exact provider project/service IDs, regions, actual URLs, environment names and last successful commit/revision; never secret values.
- [ ] Keep encrypted/private pg_dump backups outside Git. For the initial personal app, take a weekly backup and another before schema changes; retain four weekly copies and the migration-cutover backup.
- [ ] Restore a backup into a disposable DB at least once before accepting the migration. Record restore procedure and approximate duration.
- [ ] Record Render logs, GitHub job links and Neon usage/connection diagnostics to inspect for failures.
- [ ] Explain key rotation: generate new key/digest, replace backend digest, redeploy/restart backend, re-enter key in browser; update smoke-test credential in GitHub.
- [ ] Roll application code back to the last verified secure release only. Do not roll back to the original username-only backend or a frontend that cannot authenticate.
- [ ] Keep schema changes additive/backward compatible: migrations run while old code may still serve. For destructive changes use a separately planned maintenance window and verified backup.
- [ ] Do not run alembic downgrade automatically on application failure. A code rollback is not a database rollback.
- [ ] For data recovery, stop writes, restore into a new DB, verify counts/revision, switch DATABASE_URL, deploy compatible code and verify before retiring the failed DB.
- [ ] Do not return to the stale local database after hosted writes; first transfer the authoritative hosted data if reverting to local hosting.
- [ ] Update README's misleading “username-based auth” wording and explain protected personal mode, local commands, hosted cost assumptions and runbook link.
- [ ] Leave PLAN.md as historical design; note the current reset/day-view behavior in new documentation.

**Gate:** Another session can deploy, diagnose a failed release, rotate the access key and restore data using the runbook without inventing a new strategy.

## 6. Environment Variables Needed

| Variable | Where | Value / policy |
|---|---|---|
| APP_ENV | Render API | prod; local Compose dev; migration-only CI may use dev without starting a server. |
| AUTH_MODE | Render API | personal; only local development may use local. |
| OWNER_USERNAME | Render API | Exact existing local username. Not a credential, but authoritative identity. |
| PERSONAL_ACCESS_KEY_SHA256 | Render API secret | SHA-256 hex digest of a randomly generated 32-byte-or-stronger key. |
| DATABASE_URL | Render API secret | postgresql+psycopg:// application-role credentials at Neon pooled hostname, TLS required. |
| MIGRATION_DATABASE_URL | GitHub production secret / operator migration environment | Direct Neon endpoint with migration-owner role. Not present on runtime API. |
| RUN_MIGRATIONS | API container | false on Render, true in local Compose. |
| CORS_ORIGINS | Render API | Exact HTTPS frontend origin; comma-separated additional explicitly approved origins only. |
| LOG_LEVEL | Render API | info, temporarily debug only with secret-redacted logging. |
| PORT | Platform/container | Render-provided; use fallback 8000 locally. |
| TZ | Render API | America/Toronto for this personal deployment. |
| DB_POOL_SIZE | Render API | 2 initially. |
| DB_MAX_OVERFLOW | Render API | 3 initially. |
| DB_POOL_TIMEOUT | Render API | 15 seconds initially. |
| DB_CONNECT_TIMEOUT | Render API | 10 seconds initially. |
| VITE_API_BASE_URL | Render static build | https://<assigned-api-host>/api; public, baked into bundle. |
| VITE_AUTH_MODE | Render static build | personal; public UI mode, never a security decision on the server. |
| NODE_VERSION | Render static build | 22 after compatibility gate. |
| SKIP_INSTALL_DEPS | Render static build | true because build explicitly runs npm ci. |
| RENDER_API_KEY | GitHub production secret | Allows ordered deployment/status checks; never frontend/runtime. |
| RENDER_API_SERVICE_ID | GitHub variable | Actual backend service ID. |
| RENDER_WEB_SERVICE_ID | GitHub variable | Actual static service ID. |
| PRODUCTION_API_URL | GitHub variable | HTTPS API origin for smoke checks. |
| PRODUCTION_WEB_URL | GitHub variable | HTTPS frontend origin. |
| PERSONAL_ACCESS_KEY | GitHub production secret, if authenticated smoke is automated | Actual key, used only for authenticated smoke requests; do not print request headers. |
| TEST_DATABASE_URL | CI/test environment only | Disposable PostgreSQL database; never source/live data. |
| POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB | Local Compose only | Used by local postgres container. Neon does not read these Compose variables. |

Neither VITE_* values nor a Git-committed environment example can contain database credentials, the access key or a Render API key. Frontend env changes require a rebuild. Backend settings are read at process import/start and require restart/redeploy. A root .env is consumed by Compose; running backend from backend/ or Vite from frontend/ requires the appropriate working-directory env file or explicit process environment.

## 7. Deployment Workflow

    Feature branch
       -> PR CI: frontend build + backend tests + migration rehearsal + Docker build
       -> merge tested changes to main
       -> production workflow checks exact successful main SHA
       -> acquire one production concurrency slot
       -> migrate Neon using direct owner URL
       -> deploy backend SHA through Render API
       -> wait for that deploy ID + authenticated readiness
       -> deploy frontend SHA through Render API
       -> verify static routes and read-only end-to-end requests
       -> record SHA + migration head + verification result

Initial bootstrap: provision empty resources with auto-deployment disabled where supported, enter secrets, apply the appropriate fresh or restored database path, then release only the protected backend before importing/exposing real data. Resource creation may perform an initial build; never connect the original insecure code to the real database.

Production commands:

| Task | Directory / environment | Command |
|---|---|---|
| Frontend install/build | frontend | npm ci && npm run build |
| Frontend serving | Render static CDN | Publish dist; no Node/Vite server command. |
| Backend build | Repository root | docker build -t focusarc-api ./backend |
| Native backend equivalent | backend, provisioned env | python -m pip install -r requirements.lock followed by python -m pip install --no-deps . |
| Backend serving | /app in container | exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --workers 1 --log-level "$LOG_LEVEL"; entrypoint sets defaults first. |
| Production migration | backend, direct URL secret | alembic upgrade head |
| Migration verification | backend | alembic current; alembic heads |
| Backend tests | backend, disposable DB | python -m pytest -q |
| Local complete app | root | docker compose up -d --build |
| Local migration | root | docker compose exec api alembic upgrade head |

Do not run vite dev or vite preview as the production frontend server. Do not run migrations during Docker image build. Keep Compose's pgdata volume and empty optional init.sql for local use.

For host-native local API development, Docker's db name is not resolvable from Windows and Compose currently publishes no DB port. Use container-based API development by default. If host-native API development is desired, document an opt-in override binding PostgreSQL only to 127.0.0.1 and use that host/port, never broaden the production architecture for this convenience.

## 8. Potential Problems / Platform Limitations

- **Cold starts:** Render's free process can sleep; Neon may also resume on demand. The user may see an initial delay. Upgrade the API if this is unacceptable; frontend assets remain available independently.
- **Free quotas:** A foreground browser repeatedly queries the DB even with no timer running. Track real CPU/transfer/storage use; eight-hour personal use is an estimate, not guaranteed free operation.
- **Health checks keeping compute awake:** Do not add a DB query to Render's frequent public liveness endpoint. Use authenticated readiness only during releases/troubleshooting.
- **Ephemeral server disk:** No runtime persistence is required here, but never place backups or future uploads on the free API filesystem.
- **CORS versus security:** Correct CORS enables browser communication; the bearer check protects data even through non-browser clients.
- **Secret exposure:** Frontend bundles are public. SessionStorage is intentionally a minimal personal-access design; keep existing dependency/assets scrutiny and never inject untrusted HTML. A future multi-user app should use a separately designed session/auth system.
- **Preview origin leakage:** No wildcard provider origins or production credentials in PR previews.
- **Browser-local counters:** PostgreSQL preserves sessions/history; the exact dial uses per-origin storage. Import deliberately once; multi-device reconciliation is outside this migration.
- **Time semantics:** Client timestamps influence stop times and IANA timezone determines stored session days; averages currently use server date. Fix deployment timezone without silently changing existing session business rules.
- **Read/write failure ambiguity:** Do not retry a timed-out mutation automatically. It may have committed before the response was lost.
- **Migration ordering:** Avoid old/new API incompatibility with additive changes. Production startup must not run competing migrations.
- **Prepared statements/pooling:** Keep runtime transactions self-contained; direct URL for migrations. Verify psycopg behavior with actual installed versions.
- **Dependency drift:** Python ranges can unexpectedly pull new library behavior. Lock the demonstrated working set; do not turn deployment into a broad upgrade.
- **Windows line endings:** The current shell script has CRLF in this checkout. LF normalization is a concrete Docker portability task.
- **Test danger:** Test fixtures drop tables and skip when the URL is absent. Passing a health check or seeing skipped pytest output does not validate persistence.
- **Backups/restore window:** Free-provider recovery features are limited. Private logical dumps and a demonstrated restore are part of acceptance.
- **Provider restrictions:** Render may suspend a free service for unusually high externally initiated traffic; Neon is external. Monitor real usage and budget for the paid web instance if required.
- **Account-specific limits:** Confirm GitHub CI allowance, Render workspace bandwidth/build limits and current region availability at provisioning. No live accounts were inspected here.

## 9. Final Verification Checklist

- [ ] Application code/UI changed only where this plan requires access and deployment reliability.
- [ ] Frontend production build succeeds reproducibly.
- [ ] Backend Docker build/start succeeds with LF scripts and dynamic PORT.
- [ ] Python dependencies locked; Node version explicit.
- [ ] Production cannot start with username-only access or default local DB/CORS settings.
- [ ] Personal API data is inaccessible without the private key, including direct API-origin requests.
- [ ] Login, credential failure, lock, refresh and 401 handling work.
- [ ] No keys, DSNs or migration credentials in bundles, Git or logs.
- [ ] HTTPS frontend/API URLs valid; CORS preflight allows only expected origins/headers.
- [ ] Every SPA route refreshes correctly.
- [ ] Neon contains the expected schema and data with one verified Alembic head.
- [ ] Production runtime role cannot perform schema migration or table drops.
- [ ] Database survives restart/redeploy; backup restore rehearsed.
- [ ] Old and new database counts, UUIDs, timestamps and duration totals match.
- [ ] Browser-local counters/preferences transferred deliberately and verified.
- [ ] Create/edit/archive/start/switch/stop/adjust/reset/history/schedule/stats verified.
- [ ] Reset preserves historical sessions; end-day endpoint verified separately.
- [ ] Timezone, midnight and suspension behavior tested.
- [ ] Idle cold-start and transient DB/network failures recover without duplicate writes.
- [ ] No polling overlaps, unhandled refresh errors or background keep-alive traffic.
- [ ] CI uses disposable PostgreSQL and does not silently skip DB tests.
- [ ] Migration failure blocks both deploys; backend failure blocks frontend.
- [ ] Exact tested commit deployed and recorded for both services.
- [ ] Rollback target preserves personal access protection and is schema-compatible.
- [ ] Docker Compose still works locally with its original durable volume.
- [ ] README and deployment runbook are complete and secrets remain external.
