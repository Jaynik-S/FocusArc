# Username and Password Authentication Design

## Purpose

Replace FocusArc's shared production access key and local trusted username header with simple public username/password accounts. Preserve the timer interface, existing PostgreSQL records, local Docker development, and the Render static-site/API plus Neon and GitHub Actions deployment architecture.

Registration is public: anyone who can reach the site can create a separate account. This design intentionally does not add email verification, password reset, social login, or an external identity platform.

## Chosen Architecture

The API uses a signed browser session cookie containing only the authenticated username. Starlette's `SessionMiddleware` signs and timestamps the cookie with a private `SESSION_SECRET`; the browser cannot forge or alter the username without invalidating the signature. The cookie is HttpOnly, uses `SameSite=Lax`, is `Secure` in production, and expires after seven days. Logout clears the cookie. Rotating `SESSION_SECRET` invalidates all active logins.

This is deliberately simpler than a database-backed session table. PostgreSQL stores account identity and an Argon2id password hash, but not individual login sessions. Every protected request reads the signed username and then loads the corresponding user with a non-null password hash before authorizing access. Browser-supplied headers, request bodies, query parameters, or local-storage usernames never establish identity.

Credentialed CORS remains restricted to the exact configured frontend origin. Browser requests include credentials. For unsafe methods, the API rejects any present `Origin` header that is not one of the configured origins; requests without an `Origin` remain available to deployment scripts and other non-browser clients.

## Database and Existing Data

An additive Alembic migration adds nullable `users.password_hash VARCHAR(255)`. Existing rows, including `jayy`, receive `NULL`. A null hash means the username is reserved and cannot log in until privately initialized; public registration receives `409 username_unavailable` and can never claim or overwrite it.

No existing timer, session, day-summary, history, or statistics rows are rewritten. They already carry a username foreign key and existing services filter by username. The migration runs only through Alembic in local Compose startup or the existing GitHub release workflow; API startup never creates or migrates tables in production.

A small administrative command initializes an existing null password hash. It:

- accepts the username, defaulting operational instructions to `jayy`;
- reads the password without echoing it or placing it on the command line;
- requires confirmation by entering it twice;
- writes an Argon2id hash only when the current database value is null;
- refuses to overwrite an existing password; and
- supports a non-interactive password environment variable for the protected GitHub production environment, verifying rather than replacing an already initialized hash on later releases.

This provides a private one-time setup path while keeping subsequent releases repeatable.

## Passwords and Input Validation

`argon2-cffi`'s high-level `PasswordHasher` provides hashing, verification, and safe rehash-on-login when library parameters change. Plaintext passwords exist only in request memory or the private setup process and are never logged or persisted.

Usernames are trimmed, converted to lowercase, and must contain 1-32 ASCII lowercase letters, digits, periods, underscores, or hyphens, beginning with a letter or digit. The canonical value is stored and returned. Passwords are not trimmed and must contain 8-128 characters. API errors use stable machine-readable codes plus clear human messages.

## Authentication API

The public endpoints are:

- `GET /api/auth/session`: returns the authenticated username or `401`.
- `POST /api/auth/login`: validates a username and password. It returns `404 username_not_registered` only when no row exists, `403 password_setup_required` when an existing row has no hash, and `401 incorrect_password` for a wrong password. Success writes the signed cookie and returns the canonical username.
- `POST /api/auth/register`: requires `{ username, password, confirm: true }`. Missing or false confirmation is rejected. A new row is created only when the username is absent. Any existing row, including one with a null hash, returns `409 username_unavailable`. Success writes the signed cookie.
- `POST /api/auth/logout`: clears the cookie and returns `204`.

The registration UI first calls login. Only `username_not_registered` changes the screen to the exact question: "This username isn't registered. Create a new account?" Clicking the affirmative button calls registration with `confirm: true`; cancelling returns to the form without creating anything. Incorrect passwords and reserved existing users show errors and never enter registration mode.

All timer, session, totals, history, schedule, and statistics routes depend on the authenticated user loaded from the signed session. `/api/health` stays public. `/api/ready` remains authenticated and confirms database/migration readiness.

## Rate Limiting

Login and registration use a bounded in-memory fixed-window limiter because the deployed API intentionally runs one Uvicorn worker. Login limits apply to both source address and canonical username; registration limits apply to source address. Exceeding a limit returns `429` with a `Retry-After` header. Successful authentication clears the username-specific login failure bucket.

The limiter is intentionally basic and resets on process restart. If the API is later scaled to multiple workers or instances, it must be replaced with a shared PostgreSQL or Redis-backed limiter before scaling.

## Browser Authentication and Account-Scoped State

On application startup, `AuthProvider` calls `/auth/session` with `credentials: "include"`. The timer providers do not mount until the session is confirmed. A `401` from any protected request unmounts private UI and returns to the login screen without deleting local counters.

The authentication screen contains username, password, and Continue controls. It handles unknown-user confirmation, incorrect passwords, setup-required accounts, validation errors, rate limits, and network failures. The existing timer pages and controls remain unchanged after sign-in. The sidebar displays the authenticated username and a Logout button.

All account-specific browser keys use `coursetimers.accounts.<username>.<suffix>`. This includes cached timers, elapsed counters, offsets, session adjustments, active-session snapshots, last-active timestamps, selected timer, and theme preference. Providers receive the authenticated username explicitly and never read a username as proof of identity.

After `jayy` first signs in, a one-time compatibility function moves a legacy unscoped key only when `coursetimers.username` exactly identifies the authenticated account and the namespaced destination does not already exist. It then removes the migrated legacy key. Unowned or mismatched legacy data is left untouched and never loaded into another account. Logout only unmounts the providers and clears the signed cookie; it does not delete namespaced state.

## Deployment and Configuration

The shared-key settings are removed everywhere: `AUTH_MODE`, `OWNER_USERNAME`, `PERSONAL_ACCESS_KEY_SHA256`, `PERSONAL_ACCESS_KEY`, and `VITE_AUTH_MODE`. The frontend retains only `VITE_API_BASE_URL`.

The API adds:

- `SESSION_SECRET`: a random production-only secret of at least 32 characters;
- `SESSION_MAX_AGE_SECONDS`: defaults to `604800` (seven days); and
- existing exact `CORS_ORIGINS`, database pool, and environment settings.

Local Docker supplies a development-only session secret and continues to run Alembic before the development API starts. Render continues with `RUN_MIGRATIONS=false`; GitHub Actions migrates Neon before deploying the API.

The production workflow privately supplies the `jayy` password to the administrative initializer after migration and before API deployment. On the first run it sets the null hash; later runs verify that the same credential still works and never overwrite it. The API smoke test logs in with username/password, retains the cookie, checks readiness and `/me`, verifies unauthenticated denial, logs out, and confirms the session is rejected. Secrets are never printed.

Documentation provides exact PowerShell, Neon, Render, and GitHub steps, including generating `SESSION_SECRET`, setting the initial `jayy` password in the GitHub production environment, updating the Render environment, checking runtime-role grants on `users`, running the ordered release, removing obsolete shared-key settings, and validating the hosted flow. The documentation states that registration is public.

## Tests and Acceptance Evidence

Backend tests use only the guarded disposable `focusarc_test` PostgreSQL database. They cover:

- migration from an existing user with a null password hash;
- private password initialization and overwrite refusal;
- explicit registration confirmation;
- successful registration and login;
- unknown usernames, wrong passwords, duplicate usernames, and reserved null-hash users;
- cookie tampering, logout, and configurable session expiry;
- login and registration rate limits;
- rejection of a browser-supplied username without a valid signed cookie;
- two-account isolation for timers, sessions, history, statistics, updates, and deletes; and
- production configuration validation.

Frontend tests cover the requested form, exact registration question, confirmation and cancellation, wrong-password behavior, startup session restoration, expiry-induced sign-out, logout, credentialed requests, account-specific storage, safe legacy `jayy` migration, and preservation of counters when switching accounts.

Release verification includes the full backend suite, migration rehearsal on a separate empty disposable database, deployment-script tests, frontend tests, frontend build, and Linux API image build. The application is not described as live until the exact production commit has been deployed and the updated hosted smoke checks and manual acceptance flow have passed.

## Non-Goals

This change does not add email addresses, verification, password-reset email, social authentication, multi-factor authentication, account deletion, password changes, administrative web screens, or a third-party authentication service.
