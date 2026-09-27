# FocusArc account authentication implementation

Updated 2026-09-27. Work is implemented on `user-password-auth`; this document does not claim a hosted deployment.

## Implemented

- PostgreSQL `users.password_hash`, added by Alembic revision `0003_add_password_hash` as nullable so existing rows are preserved.
- Argon2id password hashing and normalized, validated usernames.
- Login, explicit-confirmation public registration, session check, and logout endpoints.
- Signed HTTP-only sessions with a seven-day fixed expiry, production `Secure` and `SameSite=None` attributes for the separate Render origins, and exact credentialed CORS.
- Backend identity enforcement for all private timers, sessions, history, readiness, totals, and statistics routes.
- Login and registration rate limits with stable validation/error responses.
- Private, idempotent `python -m app.admin set-initial-password --username <name>` procedure for existing users such as `jayy`. It never overwrites an existing password.
- Frontend username/password screen, exact unknown-user confirmation, error handling, and Logout button.
- Account-scoped `coursetimers.accounts.<username>.*` browser state with safe one-time migration of legacy keys only when the recorded legacy owner matches.
- Updated local Docker, Render Blueprint, GitHub Actions release, schema check, and cookie-based deployment smoke test.

## Verified locally

- Backend tests run only against a disposable PostgreSQL database.
- Frontend component/unit tests and production TypeScript/Vite build pass.
- Deployment orchestration/smoke unit tests pass.
- Compose configuration validates.

See [deployment.md](deployment.md) for the current production checklist and exact manual steps. Provider configuration, merge to `main`, production migration, deployment, and hosted browser acceptance remain manual and are not yet claimed complete.
