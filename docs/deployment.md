# FocusArc production deployment runbook

Updated 2026-09-27. Architecture: Render Static Site, Render Docker Web Service, Neon PostgreSQL, and GitHub Actions. This runbook describes the username/password release; it does not claim that the branch is deployed.

Registration is public. Anyone who can reach FocusArc can create a separate account. Accounts do not share server data or browser-local counters. There is intentionally no email verification, password-reset email, or social login.

## What the release changes

- Alembic revision `0003_add_password_hash` adds nullable `users.password_hash` without changing existing timers or sessions.
- Existing usernames with a null hash cannot be claimed by public registration. The release workflow privately initializes or verifies `jayy` before the new API is deployed.
- Passwords are Argon2id hashes. The browser receives a signed HTTP-only cookie containing only the username.
- The API, not the browser, resolves the authenticated username for every private query.
- Legacy access-key variables, bearer headers, and username headers are removed.
- Browser state moves to `coursetimers.accounts.<username>.*`. Matching legacy `jayy` keys migrate once after `jayy` signs in; logout does not delete them.

## Required production settings

### Render static site

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Build command | `npm ci && npm run build` |
| Publish directory | `dist` |
| SPA rewrite | `/*` → `/index.html` |
| `NODE_VERSION` | `22` |
| `SKIP_INSTALL_DEPS` | `true` |
| `VITE_API_BASE_URL` | Exact API HTTPS origin plus `/api`, with no trailing slash |

Delete `VITE_AUTH_MODE`; it is obsolete. Never put a password, session secret, database URL, or other secret in a `VITE_*` variable.

### Render API service

| Variable | Value |
|---|---|
| `APP_ENV` | `prod` |
| `DATABASE_URL` | Neon pooled TLS URL for the restricted runtime role |
| `RUN_MIGRATIONS` | `false` |
| `CORS_ORIGINS` | Exact static-site HTTPS origin, without path or trailing slash |
| `SESSION_SECRET` | New random value of at least 32 characters |
| `SESSION_MAX_AGE_SECONDS` | `604800` |
| `TZ` | `America/Toronto` |
| `LOG_LEVEL` | `info` |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | `2` / `3` |
| `DB_POOL_TIMEOUT` / `DB_CONNECT_TIMEOUT` | `15` / `10` |

Delete `AUTH_MODE`, `OWNER_USERNAME`, and `PERSONAL_ACCESS_KEY_SHA256`. Do not put `jayy`'s password on Render. The running API uses only the restricted runtime database URL; GitHub Actions uses the migration-owner URL.

`render.yaml` marks `SESSION_SECRET` as `sync: false`, but this does not prompt again when updating an existing Blueprint-managed service. Enter the value directly in the existing API service's Render Dashboard before deployment.

The static site and API have separate `onrender.com` origins. Production cookies therefore use `SameSite=None; Secure`, and CORS permits credentials only from `CORS_ORIGINS`. `onrender.com` is a public suffix, so hosted browser acceptance is mandatory. If a browser or policy blocks cross-site cookies, attach same-site custom domains such as `app.example.com` and `api.example.com`, update `VITE_API_BASE_URL` and `CORS_ORIGINS`, and redeploy both services.

### GitHub production environment

Environment secrets:

- `MIGRATION_DATABASE_URL`: Neon direct owner TLS URL for Alembic and the one-time account initializer.
- `RENDER_API_KEY`: Render API key with access to both services.
- `PRODUCTION_AUTH_PASSWORD`: the chosen `jayy` password, 8–128 characters. Keep this stable for later releases; the initializer verifies it and refuses to overwrite a different hash.

Environment variables:

- `PRODUCTION_AUTH_USERNAME=jayy`
- `RENDER_API_SERVICE_ID=srv-...`
- `RENDER_WEB_SERVICE_ID=srv-...`
- `PRODUCTION_API_URL=https://<api-host>` without `/api`
- `PRODUCTION_WEB_URL=https://<web-host>`

Repository-level Actions variable:

- `PRODUCTION_DEPLOY_ENABLED=true` only when provider setup and the backup are ready.

Restrict the `production` environment to `main` and enable required approval if the GitHub plan supports it.

## Exact release order

1. Stop writes and take a current Neon backup or create a protected Neon branch/restore point. Record the existing Alembic revision and confirm the `jayy` row exists.
2. Run all local checks on `user-password-auth`.
3. Push the branch, review it, merge it to `main`, and wait for the exact `main` commit's CI run to pass.
4. Update the Render settings above before deploying the new API. In particular, add `SESSION_SECRET`, set exact CORS, and remove legacy auth variables.
5. Configure the GitHub production environment secrets/variables above.
6. Enable `PRODUCTION_DEPLOY_ENABLED` and manually run the Deploy workflow with the successful CI commit's full 40-character SHA.
7. The workflow runs `alembic upgrade head`, records revision `0003_add_password_hash`, then executes:

   ```text
   python -m app.admin set-initial-password --username jayy
   ```

   `PRODUCTION_AUTH_PASSWORD` is passed through `FOCUSARC_INITIAL_PASSWORD`, never as a command argument. The command sets a null hash once, verifies the same password on later releases, and fails instead of replacing a different password.
8. The workflow deploys the exact backend SHA and smoke-tests health, unauthenticated denial, login, migration revision, `/me`, session identity, logout, and denial after logout.
9. Only after the API smoke test passes, the workflow deploys the exact frontend SHA and checks the SPA routes and built assets.
10. Complete the hosted browser checks below. Only then remove any locally saved legacy access key. The old Render auth variables should already be gone.

Alembic never runs during production API startup. A failed migration, initializer, backend deploy, or backend smoke test prevents the frontend deploy.

## PowerShell checklist

Run from the repository root:

```powershell
git switch user-password-auth
git status --short

docker compose config --quiet
docker build -t focusarc-auth-release ./backend

Push-Location frontend
npm ci
npm test
npm run build
Pop-Location

py -3 -m unittest discover -s scripts/tests -v
```

The backend suite must use a disposable database whose database and role are both named `focusarc_test`; never point pytest at Neon or a personal database. The GitHub CI workflow provisions this automatically. For the local Docker test database described in the development plan:

```powershell
$backendPath = (Resolve-Path .\backend).Path
docker run --rm --network focusarc-auth-test `
  -v "${backendPath}:/app" -w /app `
  -e APP_ENV=dev `
  -e DATABASE_URL=postgresql+psycopg://focusarc_test:focusarc_test@focusarc-test-db:5432/focusarc_test `
  -e TEST_DATABASE_URL=postgresql+psycopg://focusarc_test:focusarc_test@focusarc-test-db:5432/focusarc_test `
  --entrypoint python focusarc-auth-release -m pytest -ra
```

Generate the Render session secret locally, copy it directly into Render, then remove the shell variable:

```powershell
$sessionSecretBytes = New-Object byte[] 48
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($sessionSecretBytes)
$sessionSecret = [Convert]::ToBase64String($sessionSecretBytes)
$sessionSecret
Remove-Variable sessionSecret, sessionSecretBytes
```

Push the feature branch:

```powershell
git push -u origin user-password-auth
```

After review and merge, update local `main`, capture the tested SHA, and confirm its CI run passed:

```powershell
git switch main
git pull --ff-only
$releaseSha = git rev-parse HEAD
$releaseSha
gh run list --workflow ci.yml --commit $releaseSha
```

Optional GitHub CLI setup (the UI is equally valid). These commands prompt for secret values instead of placing them on the command line:

```powershell
gh secret set MIGRATION_DATABASE_URL --env production
gh secret set RENDER_API_KEY --env production
gh secret set PRODUCTION_AUTH_PASSWORD --env production

gh variable set PRODUCTION_AUTH_USERNAME --env production --body "jayy"
gh variable set RENDER_API_SERVICE_ID --env production --body "srv-REPLACE"
gh variable set RENDER_WEB_SERVICE_ID --env production --body "srv-REPLACE"
gh variable set PRODUCTION_API_URL --env production --body "https://REPLACE.onrender.com"
gh variable set PRODUCTION_WEB_URL --env production --body "https://focusarc.onrender.com"
gh variable set PRODUCTION_DEPLOY_ENABLED --body "true"
```

Start and monitor the gated release only after the exact SHA has successful CI:

```powershell
gh workflow run deploy.yml --ref main -f sha=$releaseSha
gh run list --workflow deploy.yml --limit 5
gh run watch
```

Do not paste database URLs, passwords, API keys, or session secrets into terminal command arguments, Git, issue comments, or chat.

## Neon verification

Use the Neon SQL editor or `psql` with the direct owner URL after the workflow migration:

```sql
SELECT version_num FROM alembic_version;
SELECT username, password_hash IS NOT NULL AS password_configured
FROM users
WHERE username = 'jayy';
```

Expected revision: `0003_add_password_hash`. Expected result: one `jayy` row with `password_configured = true`. Do not select or copy the hash itself. Existing timer/session row counts and totals must match the pre-release record.

For runtime least privilege, retain the existing restricted role: `SELECT/INSERT/UPDATE/DELETE` on application tables, `SELECT` on `alembic_version`, sequence use where required, and no schema ownership or `CREATE` privilege. Review grants after applying the migration.

## Hosted browser acceptance

Use the Render static-site URL in a normal browser:

1. Confirm the page shows Username, Password, and Continue.
2. Sign in as `jayy`; confirm the existing timers, history, statistics, and saved counters appear.
3. In a private window, enter `jayy` with a wrong password. Confirm it shows an error and never offers account creation.
4. Enter a genuinely unused username. Confirm the exact question “This username isn’t registered. Create a new account?” appears and that Cancel creates nothing. Only press Create account if you intentionally want that permanent public account.
5. Start/stop a timer, reload, and verify the state persists.
6. Click Logout. Confirm the timer UI disappears, direct private routes show the sign-in screen, and `jayy`'s counters return after signing back in.
7. If testing a second account, verify it cannot see `jayy` timers, sessions, history, statistics, theme, selected timer, or counters; then switch back and confirm `jayy` data is unchanged.
8. Leave the app idle past the configured expiry only in a dedicated expiry test environment, or use the automated backend test. Confirm the next private request returns to sign-in.
9. In browser DevTools, confirm requests use cookies and do not send `Authorization` or `X-Username`. Confirm the session cookie is HttpOnly, Secure, and SameSite=None in production.

Public registration is intentionally available to every visitor who can reach the site. Rate limiting is basic and per API process; keep the API at one worker unless rate limiting is moved to shared storage.

## Browser-state migration

On first authenticated render, the frontend checks the legacy `coursetimers.username`. It copies legacy timer/preference keys only when that value exactly matches the authenticated username and only when the new destination key is empty. It then removes those migrated legacy keys. Data with a different or missing recorded owner is left untouched, preventing accidental assignment to the wrong account.

New keys use this shape:

```text
coursetimers.accounts.jayy.timers
coursetimers.accounts.jayy.timerElapsed
coursetimers.accounts.jayy.timerOffsets
coursetimers.accounts.jayy.sessionAdjustments
coursetimers.accounts.jayy.activeSession
coursetimers.accounts.jayy.lastActiveAt
coursetimers.accounts.jayy.selectedTimerId
coursetimers.accounts.jayy.theme
```

Logout preserves these values. It does not preserve or expose a login session.

## Failure and rollback

- Do not rerun a failed deployment blindly. Inspect the failed GitHub step and the exact Render deploy ID first.
- Migration `0003` is additive and nullable, so the prior API can run with it if the new deployment fails. Do not downgrade automatically.
- If the initializer reports that the password is already set, verify that the GitHub secret contains the original chosen password. The tool intentionally refuses to reset it.
- Rolling back the frontend and API does not remove the nullable column or password hash. Keep the pre-release backup until hosted acceptance is complete.
- Rotating `SESSION_SECRET` invalidates every session immediately. Rotate only deliberately, then sign in again.
- A public `/api/health` response proves only that the process is running. Authenticated `/api/ready` and the release smoke test prove database reachability and the expected migration revision.

## Current completion boundary

Code, tests, migration, local configuration, release automation, and this runbook are prepared on `user-password-auth`. Merge, provider configuration, production migration, deployment, and hosted browser acceptance remain manual. Do not describe the hosted change as live until the exact deployed SHA and browser flow have been verified.
