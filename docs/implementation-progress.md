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

- 63 backend tests passed against the disposable `focusarc_test` PostgreSQL database.
- 16 frontend component/unit tests and the production TypeScript/Vite build passed.
- 7 deployment orchestration/smoke tests passed.
- Fresh API and frontend Docker images built; `pip check`, production settings validation,
  Compose configuration, and Render/GitHub YAML parsing passed.
- A disposable browser run verified explicit registration confirmation, wrong-password
  rejection, logout, timer recovery after signing back in, empty state for a second account,
  account-namespaced local storage, cookie authentication, and absence of browser-supplied
  identity headers. Its containers, database, generated artifacts, and temporary browser
  tooling were removed afterward.
- A migration rehearsal from revision `0002` preserved an existing null-password `jayy`
  row, upgraded to `0003_add_password_hash`, initialized its Argon2id hash once, and verified
  the same password idempotently. The rehearsal database was removed afterward.

See [deployment.md](deployment.md) for the current production checklist and exact manual steps. Provider configuration, merge to `main`, production migration, deployment, and hosted browser acceptance remain manual and are not yet claimed complete.
