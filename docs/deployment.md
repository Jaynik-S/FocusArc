# FocusArc deployment runbook

Updated 2026-09-20. Approved architecture: Render Static Site, Render Docker API, Neon PostgreSQL. The original plan's permission blockers are historical and resolved.

## Verified status

| Area | Evidence and remaining work |
|---|---|
| Checkout | Implementation commit 7208fbb9e5ea5e7520e1732363962d574e149143 is pushed to main. It extends user-updated 0cd507d, not the original September 17 branch. |
| Backend | Locked Linux Python 3.11.16 image built; 34 tests pass, two upstream deprecation warnings; pip check clean. Authentication is checked before database access. |
| Frontend | Linux Node 22 install, 12 tests and personal-mode production build pass. HTTP production API URL is rejected. |
| Release configuration | Render JSON schema, actionlint, Compose config and four deployment unit tests pass. GitHub CI succeeded for 7208fbb; production Deploy correctly skipped while setup remains gated. |
| Render | User confirmed Jay's workspace (tea-d0vvbb3ipnbc738bffv0). Static site created FIRST: srv-danqj9jm8hqs73c78tsg, https://focusarc.onrender.com. Auto-deploy off; no API created yet. |
| Neon | Existing project sweet-art-50562983, branch br-weathered-queen-b54u6al3, AWS us-east-2, PostgreSQL 15. focusarc-production has revision 0002_add_cycle_totals but zero application rows. Restricted runtime role not yet created. |
| Personal data | Last read-only source counts: 1 user, 7 timers, 155 sessions, 0 day summaries, 0 active sessions; owner jayy. No restore to Neon or browser-state transfer performed. |

Starting Docker Desktop resumed the existing local DB container through its restart policy. Do not claim the original volume was never started. No destructive test ran against original or rehearsal personal data.

## Backups and safety

Private backups remain outside Git in C:\Users\jay03\Jaynik\Backups\FocusArc:

- focusarc-pgdata-20260917.tar.gz
- focusarc-20260917.dump

Physical archive SHA-256 reverified locally:
83CF44C9E9B953B7971B718C996BC6C73D33479CD0590B93BEE101E858EEBE01.

Original volume: focusarc_pgdata. Physical rehearsal copy: focusarc_migration_rehearsal_20260917. Neither is a test target. On September 20 the logical dump was restored successfully with PostgreSQL 15 into a NEW database focusarc_restore_test on the tmpfs test container. It contains 1 user, 7 timers, 155 sessions, 0 day summaries, no active sessions, owner jayy and revision 0002_add_cycle_totals. Restore command completed in approximately one second locally.

**Cutover discrepancy:** read-only whole-row comparison against the running original database matched users and sessions, but not timers. Canonical JSON timer comparison also differs: sum(cycle_total_seconds) is 18287 in the September 17 backup and 0 in the current original. Neither was overwritten. Do not treat the old backup as a current snapshot or restore it into Neon without resolving which state is authoritative. Capture a fresh stopped-write snapshot for final cutover; preserve the historical backup separately. The rehearsal container is currently stopped and was not started for this comparison.

**Resolved cutover choice (September 20):** user authorized the simplest cutover; current local database is authoritative. Created fresh private backup focusarc-cutover-20260920-0940.dump in the same external backup directory. SHA-256: 9F2D66C8F7606CD8577D261EDFFF52E04E50D45896E13D41DD88BE1EF18A2F3F. No active sessions or running local API/web containers at capture. Restored successfully into new disposable focusarc_cutover_verify database; canonical whole-row hashes for users, timers and sessions all match current source, with counts 1/7/155 and timer cycle sum 0. Historical backups unchanged. Use this fresh dump for cutover unless local writes resume, in which case recapture first.

**Static resource creation:** [Dashboard](https://dashboard.render.com/static/srv-danqj9jm8hqs73c78tsg). Initial deployment dep-danqj9rm8hqs73c78uu0 ended build_failed as intended: build command starts with a VITE_API_BASE_URL presence guard, and that variable is deliberately absent until the actual API exists. The assigned URL is reserved, not a live application. Build uses repository root, then cd frontend; publish frontend/dist. NODE_VERSION=22, SKIP_INSTALL_DEPS=true and VITE_AUTH_MODE=personal are set. SPA rewrite remains to configure through Dashboard/API.

**Published verification:** [successful CI run](https://github.com/Jaynik-S/FocusArc/actions/runs/35502977969) for 7208fbb9e5ea5e7520e1732363962d574e149143; [gated deployment run](https://github.com/Jaynik-S/FocusArc/actions/runs/35503027459) was skipped, not deployed. No Render CLI or RENDER_API_KEY is currently available locally. Docker creation requires Dashboard/API access; the connected plugin does not support it. User-owned Static and generated tracked frontend/tsconfig.tsbuildinfo remain outside the implementation commit.

Fresh-schema migrations were independently verified in focusarc_migration_test on the same disposable tmpfs container: upgrade head twice, expected tables/columns, foreign keys and partial active-session unique index all passed. The disposable restored database contains personal backup data; do not expose its container or reuse it as a destructive pytest target.

Tests drop/recreate tables. Their guard permits only database/user focusarc_test at explicit local/test hosts. Use the tmpfs focusarc-test-db container on focusarc-migration-test. Never pass .env.local or Neon credentials to pytest. Backups, browser exports, .env variants and .neon are ignored. The untracked Static artifact is user-owned and untouched.

## Exact remaining setup

### 1. Publish the secure source

Review and stage only intended source/config/docs/tests, not private files or unrelated artifacts. Run the checks below, commit and push main, and wait for successful CI for its full SHA. Leave repository Actions variable PRODUCTION_DEPLOY_ENABLED unset/false during setup. Never expose the original insecure backend against personal data.

### 2. Create the static site FIRST

Confirm Jay's workspace to the connected Render tool. Check existing services before creating anything. In Render choose **New > Static Site**, connect Jaynik-S/FocusArc, branch main, and request the name **focusarc**. Record its actual assigned URL and service ID before creating the API. Creating it first requests https://focusarc.onrender.com but cannot guarantee availability; do not silently substitute a hostname.

| Static setting | Value |
|---|---|
| Root | frontend |
| Build | npm ci && npm run build |
| Publish | dist |
| Auto-deploy | Off |
| Rewrite | /* to /index.html, action Rewrite |
| NODE_VERSION | 22 |
| SKIP_INSTALL_DEPS | true |
| VITE_AUTH_MODE | personal |
| VITE_API_BASE_URL | Actual API HTTPS origin plus /api, no trailing slash |

The plugin static-creation tool has no root argument: use build `cd frontend && npm ci && npm run build` and publish `frontend/dist` from repository root instead. Add the rewrite in Dashboard afterward. Until the API URL exists, leave VITE_API_BASE_URL absent so the initial build fails safely, then set it for the ordered release. Do not assume an API hostname.

render.yaml is a validated settings reference. YAML order does not guarantee creation order. Do not apply the full Blueprint before reserving the static site, or blindly apply it afterward and duplicate services.

### 3. Prepare Neon and transfer database records

The existing focusarc-production database is schema-initialized and empty. Do not restore a full schema dump over it using --clean. In the same production branch create a NEW EMPTY database, for example focusarc-hosted, owned by focusarc-production_owner.

Before cutover stop any local timer and local API/web writes, record source counts/totals, export browser state, and take a fresh logical dump outside Git if data changed after September 17. Use PostgreSQL 15 `pg_restore --no-owner --no-acl --exit-on-error` into the new empty database. Supply its direct owner TLS connection through a private environment/connection file; never paste secrets in chat or logs. Do not run Alembic before a full schema restore. Then run `alembic upgrade head` using MIGRATION_DATABASE_URL.

Compare source/destination revision, owner jayy, UUIDs, counts, active sessions, per-timer cycle totals, summed durations and sample timestamps/day dates. The 1/7/155/0 baseline applies only if no later source writes occurred.

Create a separate login role focusarc_app with a securely generated password and no owner/admin memberships. As the owner, in the selected database apply:

```sql
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE "focusarc-hosted" TO focusarc_app;
GRANT USAGE ON SCHEMA public TO focusarc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  users, timers, sessions, day_summaries TO focusarc_app;
GRANT SELECT ON TABLE alembic_version TO focusarc_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO focusarc_app;
ALTER DEFAULT PRIVILEGES FOR ROLE "focusarc-production_owner" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO focusarc_app;
ALTER DEFAULT PRIVILEGES FOR ROLE "focusarc-production_owner" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO focusarc_app;
```

Do not grant schema CREATE or ownership to the runtime role. Check effective privileges and prove forbidden DDL on an isolated scratch object, not a real table. Review grants after future migrations. Runtime uses the pooled Neon TLS endpoint; restore/migrations use the direct owner endpoint. SQLAlchemy accepts postgresql+psycopg://; PostgreSQL CLI utilities require postgresql://.

### 4. Create Docker API after the static site exists

In Render choose **New > Web Service**, same repo, secure tested main commit, Docker runtime, name focusarc-api, Ohio region, Free instance. Root directory empty; Docker context ./backend; Dockerfile ./backend/Dockerfile. Leave Docker command blank, health path /api/health, auto-deploy Off. The plugin web-service creation description excludes Docker creation: use Dashboard/API, not an unapproved native-Python substitute.

| API environment | Value |
|---|---|
| APP_ENV / AUTH_MODE | prod / personal |
| OWNER_USERNAME | jayy |
| PERSONAL_ACCESS_KEY_SHA256 | SHA-256 hex digest of random private key |
| DATABASE_URL | Pooled TLS URL for restricted focusarc_app role |
| RUN_MIGRATIONS | false |
| CORS_ORIGINS | Actual static HTTPS origin, without slash/path/wildcard |
| TZ / LOG_LEVEL | America/Toronto / info |
| DB_POOL_SIZE / DB_MAX_OVERFLOW | 2 / 3 |
| DB_POOL_TIMEOUT / DB_CONNECT_TIMEOUT | 15 / 10 |

Render supplies PORT; the image binds 0.0.0.0:$PORT. Never place migration-owner credentials on the running API. Generate at least 32 random bytes for the key (Python secrets.token_urlsafe(32)), save the original in a password manager, and compute its digest privately. ACCESS_KEY is obsolete. Never put credentials in VITE_*.

Record actual IDs/origins; set frontend API URL and exact backend CORS. Initial resource creation may start a build even with auto-deploy off; use only secure tested source. This is not evidence of an ordered release.

### 5. Configure GitHub

In repository **Settings > Environments**, create production, restrict to main, and require approval if supported. Add environment secrets through GitHub's UI:

- MIGRATION_DATABASE_URL: selected database's direct owner TLS URL.
- RENDER_API_KEY: Render API key for the confirmed workspace.
- PERSONAL_ACCESS_KEY: original private key matching the API digest.

Add production environment variables:

- RENDER_API_SERVICE_ID: Docker API srv-... ID.
- RENDER_WEB_SERVICE_ID: static site srv-... ID.
- PRODUCTION_API_URL: API HTTPS origin WITHOUT /api.
- PRODUCTION_WEB_URL: static HTTPS origin.

After setup/data verification, set repository-level Actions variable PRODUCTION_DEPLOY_ENABLED=true (not only environment-level). Open **Actions > Deploy > Run workflow**, choose main, and enter the successful CI commit's full SHA.

The workflow checks main ancestry and successful CI before exposing production secrets, serializes production releases, migrates, deploys the exact backend SHA, verifies readiness/revision/owner and unauthenticated denial, then deploys the same frontend SHA and verifies routes/assets. Migration/backend failure blocks frontend. Record run URL, SHA, revision and both deploy IDs.

### 6. Transfer browser state once

Database backups do not capture displayed dial counters/preferences. Stop the active timer first. On the old localhost origin, use DevTools to download an allowlisted export:

```js
const keys = ['coursetimers.username', 'coursetimers.timerElapsed',
  'coursetimers.timerOffsets', 'coursetimers.sessionAdjustments',
  'coursetimers.selectedTimerId', 'coursetimers.theme'];
const state = Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)])
  .filter(([, v]) => v !== null));
const link = document.createElement('a');
link.href = URL.createObjectURL(new Blob([JSON.stringify(state)], {type: 'application/json'}));
link.download = 'focusarc-browser-state.json';
link.click();
URL.revokeObjectURL(link.href);
```

Check username jayy; save outside Git. Do not export sessionStorage, keys, stale active-session markers or all browser storage. On the new origin while locked, back up any existing destination values, then import with a local file picker:

```js
const allowed = new Set(['coursetimers.username', 'coursetimers.timerElapsed',
  'coursetimers.timerOffsets', 'coursetimers.sessionAdjustments',
  'coursetimers.selectedTimerId', 'coursetimers.theme']);
const picker = document.createElement('input');
picker.type = 'file'; picker.accept = '.json';
picker.onchange = async () => {
  const state = JSON.parse(await picker.files[0].text());
  if (state['coursetimers.username'] !== 'jayy' ||
      Object.entries(state).some(([k, v]) => !allowed.has(k) || typeof v !== 'string')) {
    throw new Error('Unexpected browser-state export');
  }
  Object.entries(state).forEach(([k, v]) => localStorage.setItem(k, v));
  location.reload();
};
picker.click();
```

Unlock, compare every counter/theme, then lock/unlock and refresh. Do not repeatedly import after hosted use begins. Keep local API/web stopped after cutover; use one authoritative database.

### 7. Hosted acceptance

Verify direct SPA routes, CORS, valid/invalid key, lock/reload, timer create/edit/archive/start/switch/stop, adjustments/negative clamp, Reset Totals preserving history, end-day separately, history/schedule/stats and Toronto midnight/DST. Verify cold-start/network recovery, background polling pause, five-minute suspension behavior and persistence across API restart. Account for rows created by write tests. These hosted checks have not been completed.

## Local checks

Compose config can be checked without starting the personal source stack: `docker compose config --quiet`. Compose retains its volume and explicit dev/local mode; do not casually start source writes during cutover.

Backend tests use the image and disposable database only:

```powershell
docker build -t focusarc-release-api ./backend
docker run --rm --network focusarc-migration-test -e APP_ENV=dev -e AUTH_MODE=local -e DATABASE_URL=postgresql+psycopg://focusarc_test:focusarc_test@focusarc-test-db:5432/focusarc_test -e TEST_DATABASE_URL=postgresql+psycopg://focusarc_test:focusarc_test@focusarc-test-db:5432/focusarc_test --mount type=bind,source=C:/Users/jay03/Jaynik/Projects/FocusArc/backend/tests,target=/app/tests,readonly --entrypoint python focusarc-release-api -m pytest -q
py -3.11-arm64 -m unittest discover -s scripts/tests -v
```

Frontend: Node 22, npm ci, npm test, npm run build with VITE_AUTH_MODE=personal and valid HTTPS /api URL. CI uses https://api.example.invalid/api only as a build fixture.

Vite 6.4.3 is a targeted patched major for audited Vite 5 file-access issues. Two moderate React Router findings remain (untrusted navigation targets and SSR error deserialization); reviewed app uses fixed internal destinations and client-only BrowserRouter. Audit is not clean; do not force unrelated major upgrades blindly.

## Backups, diagnosis and rollback

Keep weekly private dumps (four weekly copies), plus cutover and pre-migration backups. Restore to a new disposable DB and compare data before accepting migration. Account-specific provider retention remains to verify.

Inspect the failing GitHub step, Render deploy ID/logs and Neon connections/usage. Public /api/health does not touch the DB; authenticated /api/ready checks connectivity/readable revision. Release smoke requires the expected revision. Production docs/OpenAPI are disabled.

Rotate keys by updating Render digest and GitHub smoke secret together, restarting API, then re-entering the key in browsers. Never include keys in frontend environment variables.

Rollback only to a verified secure, schema-compatible release. Keep migrations additive; never automatically downgrade on deploy failure. For recovery stop writes, restore into a NEW DB, compare, switch URLs and deploy compatible code. Never resume a stale local database after hosted writes without first transferring authoritative data back.

## Outstanding acceptance gates

Real production deployment, runtime-role privilege proof, Neon restore, final cutover, browser-state transfer and hosted acceptance remain pending. GitHub CI and local logical restore are verified, not hosted restoration. Static URL assignment is verified, but no live application or deployed release SHA is claimed. The historical implementation-plan checkboxes must not be marked complete merely because code exists.

References: [Render Blueprint specification](https://render.com/docs/blueprint-spec), [exact-commit deploy API](https://api-docs.render.com/reference/create-deploy), [GitHub settings](https://github.com/Jaynik-S/FocusArc/settings), [Render Dashboard](https://dashboard.render.com/).
