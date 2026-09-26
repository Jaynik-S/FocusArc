# Username and Password Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace FocusArc's shared access key and trusted username header with public username/password accounts authenticated by a signed HttpOnly cookie, while preserving existing user data and timer behavior.

**Architecture:** FastAPI stores nullable Argon2id password hashes on `users`; Starlette signs and expires a username-only session cookie. Every private route resolves the database user from that signed session, while the React app restores the session on startup and namespaces every cached counter and preference by authenticated username.

**Tech Stack:** FastAPI, Starlette `SessionMiddleware`, SQLAlchemy 2, Alembic, PostgreSQL 15, `argon2-cffi`, React 18, TypeScript, Vitest, Docker Compose, Render, Neon, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-26-username-password-auth-design.md`

## Global Constraints

- Preserve the existing timer screens and behavior after authentication.
- Registration is public and creates a separate account only after explicit confirmation.
- Normalize usernames to lowercase ASCII and validate 1-32 characters; validate passwords at 8-128 characters without trimming them.
- Never store or log a plaintext password, reversible password, shared access key, or browser-supplied identity.
- Existing users receive a null password hash and remain unclaimable through public registration.
- The private initializer may set a null hash or verify the existing hash, but never replace it.
- Use a seven-day signed HttpOnly cookie; use `Secure` in production and exact-origin credentialed CORS.
- Run schema changes with Alembic through the existing release workflow, never during production API startup.
- Run destructive database tests only against the guarded disposable `focusarc_test` database.
- Preserve unrelated working-tree changes, especially `docs/deployment.md`, `docs/finish-render-setup.md`, `frontend/tsconfig.tsbuildinfo`, and `Static`.

---

### Task 1: Add the Password Column and Security Primitives

**Files:**
- Create: `backend/alembic/versions/0003_add_password_hash.py`
- Create: `backend/app/security.py`
- Create: `backend/app/schemas/auth.py`
- Modify: `backend/app/models/user.py`
- Modify: `backend/app/settings.py`
- Modify: `backend/pyproject.toml`
- Modify: `backend/requirements.lock`
- Test: `backend/tests/test_auth.py`
- Test: `backend/tests/test_release.py`

**Interfaces:**
- Produces: `normalize_username(value: str) -> str`, `hash_password(password: str) -> str`, `verify_password(password_hash: str, password: str) -> bool`, `password_needs_rehash(password_hash: str) -> bool`.
- Produces: `LoginRequest`, `RegisterRequest`, and `AuthUser` Pydantic models.
- Produces: `Settings.session_secret: str` and `Settings.session_max_age_seconds: int`.
- Produces: nullable `User.password_hash: str | None`.

- [ ] **Step 1: Write failing validation and hashing tests**

Add focused tests whose expected values are literal and whose production mutations are invalid normalization, plaintext persistence, or incorrect verification:

```python
@pytest.mark.parametrize(("raw", "expected"), [
    (" Jayy ", "jayy"),
    ("student-2", "student-2"),
])
def test_username_normalization(raw, expected):
    assert normalize_username(raw) == expected

@pytest.mark.parametrize("raw", ["", " space", "bad/name", "x" * 33])
def test_invalid_usernames_are_rejected(raw):
    with pytest.raises(ValueError):
        normalize_username(raw)

def test_argon2_hash_is_not_plaintext_and_verifies():
    encoded = hash_password("correct horse")
    assert encoded != "correct horse"
    assert encoded.startswith("$argon2id$")
    assert verify_password(encoded, "correct horse") is True
    assert verify_password(encoded, "wrong horse") is False

def test_registration_requires_literal_confirmation():
    with pytest.raises(ValidationError):
        RegisterRequest(username="new-user", password="password1", confirm=False)
```

- [ ] **Step 2: Run the new tests and verify RED**

Run: `cd backend; python -m pytest tests/test_auth.py -q`

Expected: collection or import failures because `app.security`, auth schemas, and the password field do not exist.

- [ ] **Step 3: Add the additive migration and model field**

Implement revision `0003_add_password_hash`, revising `0002_add_cycle_totals`:

```python
def upgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.String(255), nullable=True))

def downgrade() -> None:
    op.drop_column("users", "password_hash")
```

Add `password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)` to `User`. Do not update any existing row in the migration.

- [ ] **Step 4: Implement validation and Argon2id helpers**

Use one module-level `argon2.PasswordHasher` and translate `VerifyMismatchError`, `VerificationError`, and malformed hashes into `False`. `normalize_username` must strip, lowercase, and validate with `re.fullmatch(r"[a-z0-9][a-z0-9._-]{0,31}", value)`.

Define schemas with these exact shapes:

```python
class LoginRequest(BaseModel):
    username: str
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def canonical_username(cls, value: str) -> str:
        return normalize_username(value)

class RegisterRequest(LoginRequest):
    confirm: Literal[True]

class AuthUser(BaseModel):
    username: str
```

- [ ] **Step 5: Add production session settings and locked dependencies**

Replace shared-key settings with:

```python
session_secret: str = "local-development-session-secret"
session_max_age_seconds: int = Field(default=604800, ge=60, le=2592000)
```

Production validation must require an explicitly supplied `SESSION_SECRET` with at least 32 characters. Add `argon2-cffi` and `itsdangerous` to `pyproject.toml`, then regenerate the Linux-compatible lock with the project's Python 3.11 environment and verify `argon2-cffi`, `argon2-cffi-bindings`, `cffi`, `pycparser`, and `itsdangerous` are pinned.

- [ ] **Step 6: Extend migration and production-setting assertions**

Update `test_release.py` to assert production rejects a missing/short session secret and accepts a 32+ character secret with the existing remote TLS database and exact HTTPS origin. Add a real disposable migration test that upgrades to the old head, inserts `jayy`, then upgrades to the new head:

```python
def test_password_migration_preserves_existing_user(engine):
    config = Config("alembic.ini")
    config.set_main_option("sqlalchemy.url", str(engine.url))
    command.upgrade(config, "0002_add_cycle_totals")
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO users (username) VALUES ('jayy')"))
    command.upgrade(config, "head")
    with engine.connect() as connection:
        row = connection.execute(
            text("SELECT username, password_hash FROM users WHERE username = 'jayy'")
        ).one()
    assert row == ("jayy", None)
```

Run this test with exclusive fixture cleanup so no other test can observe the intermediate schema.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run: `cd backend; python -m pytest tests/test_auth.py tests/test_release.py -q`

Expected: hashing, validation, null legacy user, and settings tests pass; any still-failing old shared-key tests are rewritten in Task 3 before the full suite.

- [ ] **Step 8: Commit the task**

```powershell
git add backend/alembic/versions/0003_add_password_hash.py backend/app/models/user.py backend/app/security.py backend/app/schemas/auth.py backend/app/settings.py backend/pyproject.toml backend/requirements.lock backend/tests/test_auth.py backend/tests/test_release.py
git commit -m "feat: add account password foundations"
```

### Task 2: Implement Account Services, Rate Limits, and Private Initialization

**Files:**
- Create: `backend/app/services/accounts.py`
- Create: `backend/app/rate_limit.py`
- Create: `backend/app/admin.py`
- Modify: `backend/tests/test_auth.py`

**Interfaces:**
- Consumes: `User.password_hash` and the helpers from Task 1.
- Produces: `authenticate(db, username, password) -> User`, `register(db, username, password) -> User`, and `initialize_existing_password(db, username, password) -> Literal["initialized", "verified"]`.
- Produces: `FixedWindowLimiter.check(key: str, limit: int, window_seconds: int) -> None`, `clear(key: str) -> None`, and `RateLimitExceeded.retry_after`.
- Produces: `python -m app.admin set-initial-password --username jayy`.

- [ ] **Step 1: Write failing account-service tests**

Cover each branch directly against the disposable PostgreSQL fixture:

```python
def test_register_hashes_password_and_authenticates(db_session):
    user = register(db_session, "new-user", "password1")
    assert user.password_hash != "password1"
    assert authenticate(db_session, "new-user", "password1").username == "new-user"

def test_wrong_password_never_changes_existing_hash(db_session):
    user = register(db_session, "new-user", "password1")
    original = user.password_hash
    with pytest.raises(AccountError, match="incorrect_password"):
        authenticate(db_session, "new-user", "wrongpass")
    db_session.refresh(user)
    assert user.password_hash == original

def test_existing_null_hash_cannot_register_or_login(db_session):
    db_session.add(User(username="jayy"))
    db_session.commit()
    with pytest.raises(AccountError, match="username_unavailable"):
        register(db_session, "jayy", "password1")
    with pytest.raises(AccountError, match="password_setup_required"):
        authenticate(db_session, "jayy", "password1")

def test_initializer_sets_once_then_only_verifies(db_session):
    db_session.add(User(username="jayy"))
    db_session.commit()
    assert initialize_existing_password(db_session, "jayy", "password1") == "initialized"
    assert initialize_existing_password(db_session, "jayy", "password1") == "verified"
    with pytest.raises(AccountError, match="password_already_set"):
        initialize_existing_password(db_session, "jayy", "different1")
```

- [ ] **Step 2: Run account tests and verify RED**

Run: `cd backend; python -m pytest tests/test_auth.py -q`

Expected: imports fail because account service and initializer do not exist.

- [ ] **Step 3: Implement transactional account operations**

Create an `AccountError(code: str)` exception. `authenticate` distinguishes absent, null-hash, and wrong-password rows without modifying them; after successful verification it rehashes only when `password_needs_rehash` is true. `register` inserts a new canonical username and catches `IntegrityError` as `username_unavailable`. `initialize_existing_password` requires an existing row, locks it with `SELECT ... FOR UPDATE`, hashes only null values, verifies matching initialized values, and refuses a mismatch.

- [ ] **Step 4: Write failing limiter tests with an injected clock**

```python
def test_rate_limiter_blocks_until_window_expires():
    now = [100.0]
    limiter = FixedWindowLimiter(clock=lambda: now[0], max_keys=10)
    limiter.check("login:user:jayy", limit=2, window_seconds=60)
    limiter.check("login:user:jayy", limit=2, window_seconds=60)
    with pytest.raises(RateLimitExceeded) as denied:
        limiter.check("login:user:jayy", limit=2, window_seconds=60)
    assert denied.value.retry_after == 60
    now[0] = 161.0
    limiter.check("login:user:jayy", limit=2, window_seconds=60)
```

- [ ] **Step 5: Implement the bounded fixed-window limiter**

Store only `(window_started, count)` by opaque key under a lock. Reset expired windows, compute a positive integer `retry_after`, and evict the oldest key when `max_keys` is reached. Do not store passwords or request bodies in limiter keys.

- [ ] **Step 6: Implement the private administrative command**

Expose a testable `main(argv: list[str] | None = None) -> int`. Load `DATABASE_URL` or `MIGRATION_DATABASE_URL`, normalize it, and obtain a password from `FOCUSARC_INITIAL_PASSWORD` when present; otherwise use `getpass.getpass` twice and reject a mismatch. Validate password length through `LoginRequest`, call `initialize_existing_password`, print only `Password initialized for jayy` or `Existing password verified for jayy`, and never print the password or database URL.

- [ ] **Step 7: Verify focused tests and the command help path**

Run:

```powershell
cd backend
python -m pytest tests/test_auth.py -q
python -m app.admin --help
```

Expected: account and limiter tests pass; help documents `set-initial-password` and `--username` without requiring a database connection.

- [ ] **Step 8: Commit the task**

```powershell
git add backend/app/services/accounts.py backend/app/rate_limit.py backend/app/admin.py backend/tests/test_auth.py
git commit -m "feat: add account authentication services"
```

### Task 3: Replace Shared-Key API Authentication with Signed Sessions

**Files:**
- Create: `backend/app/api/auth.py`
- Modify: `backend/app/auth.py`
- Modify: `backend/app/api/router.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/conftest.py`
- Modify: `backend/tests/test_api_integration.py`
- Modify: `backend/tests/test_release.py`

**Interfaces:**
- Consumes: account services, limiter, settings, and auth schemas from Tasks 1-2.
- Produces: public `/api/auth/login`, `/api/auth/register`, `/api/auth/logout`, and protected `/api/auth/session`.
- Produces: `get_current_username(request: Request, db: Session) -> str` dependency for all private routes.

- [ ] **Step 1: Write failing API behavior tests**

Use TestClient cookie jars and real PostgreSQL rows. Add tests for registration confirmation, successful registration/login, wrong password, unknown username, duplicate/reserved username, logout, tampered cookies, expiry, rate limiting, and browser-supplied identity rejection. Start with these assertions, then add one named test for each remaining branch listed in this step:

```python
def test_unknown_login_requires_explicit_registration_confirmation(client):
    login = client.post("/api/auth/login", json={"username": "new", "password": "password1"})
    assert login.status_code == 404
    assert login.json()["detail"]["code"] == "username_not_registered"
    rejected = client.post("/api/auth/register", json={"username": "new", "password": "password1", "confirm": False})
    assert rejected.status_code == 422
    assert client.get("/api/auth/session").status_code == 401

def test_logout_clears_authenticated_session(client):
    response = client.post("/api/auth/register", json={"username": "new", "password": "password1", "confirm": True})
    assert response.status_code == 201
    assert client.get("/api/auth/session").json() == {"username": "new"}
    assert client.post("/api/auth/logout", json={}).status_code == 204
    assert client.get("/api/auth/session").status_code == 401

def test_x_username_never_authenticates(client):
    assert client.get("/api/me", headers={"X-Username": "jayy"}).status_code == 401

def test_wrong_password_does_not_register_or_replace_hash(client, db_session):
    _register(client, "jayy", "password1")
    original = db_session.get(User, "jayy").password_hash
    response = client.post("/api/auth/login", json={"username": "jayy", "password": "wrongpass"})
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "incorrect_password"
    db_session.expire_all()
    assert db_session.get(User, "jayy").password_hash == original

def test_duplicate_and_reserved_usernames_are_never_claimed(client, db_session):
    _register(client, "taken", "password1")
    client.post("/api/auth/logout", json={})
    db_session.add(User(username="jayy", password_hash=None))
    db_session.commit()
    for username in ("taken", "jayy"):
        response = client.post("/api/auth/register", json={
            "username": username, "password": "password2", "confirm": True,
        })
        assert response.status_code == 409
        assert response.json()["detail"]["code"] == "username_unavailable"

def test_tampered_cookie_is_rejected(client):
    client.cookies.set("focusarc_session", "forged")
    assert client.get("/api/auth/session").status_code == 401

def test_rate_limit_returns_retry_after(client):
    for _ in range(8):
        client.post("/api/auth/login", json={"username": "target", "password": "wrongpass"})
    denied = client.post("/api/auth/login", json={"username": "target", "password": "wrongpass"})
    assert denied.status_code == 429
    assert int(denied.headers["Retry-After"]) > 0
```

Add a parallel registration-limit test using six confirmed registration requests from one source, and the expiry test defined in Step 8. Reset the module limiter in the per-test fixture so tests cannot leak counters into one another.

- [ ] **Step 2: Run API tests and verify RED**

Run: `cd backend; python -m pytest tests/test_api_integration.py tests/test_release.py -q`

Expected: auth endpoints return 404 and the existing `X-Username` behavior contradicts the new assertions.

- [ ] **Step 3: Configure signed sessions and credentialed CORS**

Add `SessionMiddleware` before routing:

```python
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret,
    session_cookie="focusarc_session",
    max_age=settings.session_max_age_seconds,
    same_site="lax",
    https_only=settings.app_env == "prod",
)
```

Set CORS `allow_credentials=True`, retain exact origins, remove `Authorization` and `X-Username` from allowed headers, and keep `Cache-Control: no-store` for private API responses. Reject unsafe browser requests whose present `Origin` is not configured.

- [ ] **Step 4: Replace the authentication dependency**

Delete bearer-key and trusted-header logic. Read `request.session.get("username")`; reject missing values with `401`. Query `User` and require `password_hash is not None`; reject absent/reserved users with `401`. Store only the validated canonical username on `request.state.username` and return it.

- [ ] **Step 5: Implement auth routes and stable errors**

Map `AccountError` codes to statuses/messages without embedding passwords. Apply limiter keys `login:ip:<host>` (20 per 300 seconds), `login:user:<username>` (8 per 300 seconds), and `register:ip:<host>` (5 per 3600 seconds). On success clear `login:user:<username>` and assign `request.session["username"]`; on logout call `request.session.clear()`. Return `Retry-After` on `429`.

- [ ] **Step 6: Protect existing routes with the new dependency**

Change the private router dependency to `Depends(get_current_username)`. Keep health public. Keep readiness protected. `/api/me` and `/api/auth/session` both return only the session-derived username and never accept identity input.

- [ ] **Step 7: Convert existing integration helpers to authenticated clients**

Replace header dictionaries with a helper that registers or logs in through the auth API. Add two-account isolation tests proving account B cannot list, update, archive, start, stop, or aggregate account A's timers/sessions. Use literal empty/404 results and query the disposable database to confirm account A rows are unchanged.

- [ ] **Step 8: Make session expiry testable**

Construct a fresh FastAPI app through `create_app(settings)` instead of relying on import-time global settings. In the expiry test, use `session_max_age_seconds=1`, authenticate, advance the signing clock or create a timestamp-expired signed cookie, then assert `/api/auth/session` returns `401`. Keep the module-level `app = create_app()` export for Uvicorn.

- [ ] **Step 9: Run the backend suite and verify GREEN**

Run: `cd backend; python -m pytest -ra`

Expected: all backend tests pass against only `focusarc_test`, including account isolation and expiry; there are no remaining shared-key expectations.

- [ ] **Step 10: Commit the task**

```powershell
git add backend/app/api/auth.py backend/app/auth.py backend/app/api/router.py backend/app/main.py backend/tests/conftest.py backend/tests/test_api_integration.py backend/tests/test_release.py
git commit -m "feat: authenticate API with signed sessions"
```

### Task 4: Build the Username/Password Browser Flow

**Files:**
- Create: `frontend/src/components/AuthScreen.tsx`
- Modify: `frontend/src/api/apiClient.ts`
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/contexts/AuthContext.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/MainLayout.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/styles.css`
- Delete: `frontend/src/components/LockScreen.tsx`
- Delete: `frontend/src/routes/UsernameGate.tsx`
- Test: `frontend/tests/release.test.tsx`

**Interfaces:**
- Produces: `ApiError { status: number; code: string; retryAfter: number | null }` and credentialed `apiFetch`.
- Produces: `AuthContext` with `status`, `user`, `login`, `register`, and `logout`.
- Consumes: `/api/auth/*` endpoints from Task 3.

- [ ] **Step 1: Replace access-key tests with failing account-flow tests**

Write user-visible tests that name the broken behavior:

```tsx
const apiError = (status: number, code: string) =>
  json({ detail: { code, message: code.replaceAll("_", " ") } }, status);

it("asks before registering an unknown username and creates only after confirmation", async () => {
  fetchMock
    .mockResolvedValueOnce(json({}, 401))
    .mockResolvedValueOnce(apiError(404, "username_not_registered"))
    .mockResolvedValueOnce(json({ username: "new-user" }, 201));
  render(<MemoryRouter><App /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText("Username"), { target: { value: "new-user" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password1" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByText("This username isn't registered. Create a new account?")).not.toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  expect(JSON.parse(fetchMock.mock.calls[2][1]!.body as string).confirm).toBe(true);
});

it("shows an incorrect-password error without registering", async () => {
  fetchMock.mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(apiError(401, "incorrect_password"));
  render(<MemoryRouter><App /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText("Username"), { target: { value: "jayy" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrongpass" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Incorrect password");
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/auth/register"))).toBe(false);
});
```

Continue using the repository's existing `fireEvent`; do not add `@testing-library/user-event` only for typing convenience.

- [ ] **Step 2: Run frontend tests and verify RED**

Run: `cd frontend; npm test -- tests/release.test.tsx`

Expected: old access-key UI and client storage make the new assertions fail.

- [ ] **Step 3: Rewrite the API client around cookies**

Remove personal-mode flags, access-key/sessionStorage functions, username headers, and Authorization headers. Send `credentials: "include"` on every request. Parse JSON error details into `ApiError`; on protected `401`, dispatch `focusarc:auth-required`. Preserve abort and timeout behavior and never retry mutations.

- [ ] **Step 4: Rewrite AuthContext as the source of identity**

On mount call `/auth/session` with auth-notification suppressed. Keep status `checking` until it resolves. `login` and `register` return the authenticated `AuthUser`; `logout` POSTs `{}` and clears UI identity even if the response is already `401`. Listen for `focusarc:auth-required`, set anonymous, and retain browser data.

- [ ] **Step 5: Implement the exact login/registration UI**

Render username, password, and Continue. Only the stable `username_not_registered` code reveals the exact required question. Render `Create account` and `Cancel`; only the former invokes registration with `confirm: true`. Map `incorrect_password`, `password_setup_required`, `username_unavailable`, validation, `429`, and network failures to clear messages. Include visible copy: `Registration is public. Anyone who can reach this site can create a separate account.`

- [ ] **Step 6: Gate the timer runtime and add Logout**

While checking, render a neutral loading state. While anonymous, render `AuthScreen` without timer providers. When authenticated, mount the existing providers and routes. Read the username from `useAuth()` in `MainLayout`; replace Lock with Logout in `Sidebar`. Remove the obsolete username gate and all mode branching.

- [ ] **Step 7: Run focused tests and build**

Run:

```powershell
cd frontend
npm test
npm run build
```

Expected: login/confirmation/wrong-password/logout/expiry UI tests pass and TypeScript/Vite build succeeds.

- [ ] **Step 8: Commit the task**

```powershell
git add frontend/src frontend/tests/release.test.tsx
git commit -m "feat: add username password sign in flow"
```

### Task 5: Namespace All Browser State by Account

**Files:**
- Create: `frontend/src/storage/accountStorage.ts`
- Modify: `frontend/src/context/TimerRuntimeContext.tsx`
- Modify: `frontend/src/context/TimerSelectionContext.tsx`
- Modify: `frontend/src/hooks/useActiveSession.ts`
- Modify: `frontend/src/hooks/useTimers.ts`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/tests/release.test.tsx`

**Interfaces:**
- Produces: `accountStorageKey(username: string, suffix: AccountStorageSuffix) -> string`.
- Produces: `migrateLegacyAccountStorage(username: string) -> void`, `getAccountItem`, `setAccountItem`, and `removeAccountItem`.
- Changes providers/hooks to consume explicit `username: string`.

- [ ] **Step 1: Write failing storage-isolation tests**

Cover literal keys and mounted behavior:

```tsx
it("keeps counters separate when accounts switch", async () => {
  localStorage.setItem("coursetimers.accounts.alice.timerElapsed", '{"a":42}');
  localStorage.setItem("coursetimers.accounts.bob.timerElapsed", '{"b":9}');
  const alice = renderHook(() => useTimerRuntime(), { wrapper: runtimeWrapper("alice") });
  expect(alice.result.current.elapsedByTimer).toEqual({ a: 42 });
  alice.unmount();
  const bob = renderHook(() => useTimerRuntime(), { wrapper: runtimeWrapper("bob") });
  expect(bob.result.current.elapsedByTimer).toEqual({ b: 9 });
});

it("migrates only matching legacy jayy data without overwriting namespaced data", () => {
  localStorage.setItem("coursetimers.username", "jayy");
  localStorage.setItem("coursetimers.timerElapsed", '{"legacy":42}');
  migrateLegacyAccountStorage("jayy");
  expect(localStorage.getItem("coursetimers.accounts.jayy.timerElapsed")).toBe('{"legacy":42}');
  expect(localStorage.getItem("coursetimers.timerElapsed")).toBeNull();
});
```

Also assert mismatched legacy ownership stays untouched and logout leaves both accounts' namespaced values present.

- [ ] **Step 2: Run storage tests and verify RED**

Run: `cd frontend; npm test`

Expected: global keys allow cross-account reads and the storage utility is missing.

- [ ] **Step 3: Implement typed account storage and safe legacy migration**

Use the exact prefix `coursetimers.accounts.${username}.`. Allow only `timers`, `timerElapsed`, `timerOffsets`, `sessionAdjustments`, `activeSession`, `lastActiveAt`, `selectedTimerId`, and `theme`. During migration, require `coursetimers.username === username`; copy only when the destination is absent; remove each source only after a successful copy; finally remove the matching legacy username marker. Never load mismatched or ownerless legacy values.

- [ ] **Step 4: Thread authenticated username through state owners**

Pass `username` from `App` to `TimerRuntimeProvider` and `TimerSelectionProvider`, from runtime to `useActiveSession(username)`, and from `Sidebar` to `useTimers(username)`. Replace every direct global account-specific `localStorage` operation with the utility. Ensure React state initializers are keyed by the mounted username, so unmount/remount on account change cannot retain the previous account's in-memory values.

- [ ] **Step 5: Preserve logout state without exposing it**

Confirm logout unmounts providers before another user's providers mount. Do not delete account keys in AuthContext or logout. Keep reset-totals behavior scoped to the current account's elapsed/offset/adjustment keys only.

- [ ] **Step 6: Run frontend tests and build**

Run:

```powershell
cd frontend
npm test
npm run build
```

Expected: account switching, legacy migration, logout preservation, active-session behavior, and the full build pass.

- [ ] **Step 7: Commit the task**

```powershell
git add frontend/src/storage/accountStorage.ts frontend/src/context frontend/src/hooks frontend/src/components/Sidebar.tsx frontend/src/App.tsx frontend/tests/release.test.tsx
git commit -m "feat: isolate browser state by account"
```

### Task 6: Update Local and Production Configuration

**Files:**
- Modify: `.env.example`
- Modify: `backend/.env.example`
- Modify: `frontend/.env.example`
- Modify: `docker-compose.yml`
- Modify: `frontend/Dockerfile`
- Modify: `render.yaml`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/deploy.yml`
- Test: `backend/tests/test_release.py`

**Interfaces:**
- Consumes: `SESSION_SECRET`, `SESSION_MAX_AGE_SECONDS`, `PRODUCTION_AUTH_USERNAME`, and `PRODUCTION_AUTH_PASSWORD`.
- Removes: all `AUTH_MODE`, `OWNER_USERNAME`, `PERSONAL_ACCESS_KEY*`, and `VITE_AUTH_MODE` configuration.

- [ ] **Step 1: Write failing configuration assertions**

Add behavior-level tests that instantiate Settings and exercise `create_app`; do not grep source text. Assert production rejects missing/short session secrets, development accepts the documented local secret, and a configured frontend origin receives `Access-Control-Allow-Credentials: true` while an untrusted origin is denied.

- [ ] **Step 2: Run focused release tests and verify RED**

Run: `cd backend; python -m pytest tests/test_release.py -q`

Expected: credentialed CORS or environment expectations fail until configuration files and app settings agree.

- [ ] **Step 3: Update local Docker and environment examples**

Set a clearly labeled development-only `SESSION_SECRET` in Compose and examples. Remove auth mode and frontend auth build args. Keep local migrations enabled and production migrations disabled. Keep `VITE_API_BASE_URL` unchanged.

- [ ] **Step 4: Update Render Blueprint variables**

Remove the shared-key/owner/mode variables. Add `SESSION_SECRET` with `sync: false` and `SESSION_MAX_AGE_SECONDS=604800` to the API. Remove `VITE_AUTH_MODE` from the static site. Do not add a password to Render; account passwords remain hashes in Neon.

- [ ] **Step 5: Update CI and ordered release secrets**

CI supplies a non-production session secret. Deploy validation requires `PRODUCTION_AUTH_USERNAME` and `PRODUCTION_AUTH_PASSWORD` instead of `PERSONAL_ACCESS_KEY`. After Alembic migration and before backend deployment, run:

```yaml
- name: Initialize or verify production account password
  working-directory: backend
  env:
    DATABASE_URL: ${{ secrets.MIGRATION_DATABASE_URL }}
    FOCUSARC_INITIAL_PASSWORD: ${{ secrets.PRODUCTION_AUTH_PASSWORD }}
    PRODUCTION_AUTH_USERNAME: ${{ vars.PRODUCTION_AUTH_USERNAME }}
  run: python -m app.admin set-initial-password --username "$PRODUCTION_AUTH_USERNAME"
```

Later smoke steps use the same protected username/password without printing either. The initializer's verify-only behavior makes subsequent deployments idempotent without permitting password replacement.

- [ ] **Step 6: Run release tests and Compose config validation**

Run:

```powershell
cd backend
python -m pytest tests/test_release.py -q
cd ..
docker compose config --quiet
```

Expected: setting/CORS tests pass and Compose configuration is valid.

- [ ] **Step 7: Commit the task**

```powershell
git add .env.example backend/.env.example frontend/.env.example docker-compose.yml frontend/Dockerfile render.yaml .github/workflows/ci.yml .github/workflows/deploy.yml backend/tests/test_release.py
git commit -m "chore: configure account authentication deployment"
```

### Task 7: Replace Deployment Smoke Checks and Migration Assertions

**Files:**
- Modify: `scripts/smoke_deployment.py`
- Modify: `scripts/check_migration.py`
- Create: `scripts/tests/test_smoke_deployment.py`

**Interfaces:**
- Consumes: production username/password and signed cookie endpoints.
- Produces: `check_api(url, username, password, revision)` that logs in, verifies protected state, logs out, and verifies denial.

- [ ] **Step 1: Write failing smoke-check tests**

Patch the network boundary with complete HTTP response objects and assert behavior, not source text:

```python
def test_api_smoke_logs_in_checks_revision_and_logs_out(self):
    responses = [
        response(200, {"status": "ok"}),
        response(200, {"username": "jayy"}, set_cookie="focusarc_session=signed"),
        response(200, {"status": "ok", "revision": "0003_add_password_hash"}),
        response(200, {"username": "jayy"}),
        response(204, None, set_cookie="focusarc_session=; Max-Age=0"),
        error(401, {"detail": "Authentication required"}),
    ]
    with patch.object(smoke_deployment, "open_request", side_effect=responses) as opened:
        smoke_deployment.check_api("https://api.example", "jayy", "password1", "0003_add_password_hash")
    self.assertEqual(opened.call_count, 6)
```

Add a test proving neither exception text nor output includes the supplied password.

- [ ] **Step 2: Run smoke tests and verify RED**

Run: `python -m unittest discover -s scripts/tests -v`

Expected: old bearer-key function signature and requests fail the new tests.

- [ ] **Step 3: Implement cookie-aware smoke requests**

Use one `HTTPCookieProcessor(CookieJar())` opener. Send JSON login and logout POSTs with the configured production web origin, then authenticated readiness and identity GETs. Check unauthenticated `/api/me` before login and `/api/auth/session` after logout both return `401`. Report only statuses and generic failures.

- [ ] **Step 4: Extend migration checks**

Assert `users.password_hash` exists and is nullable, the Alembic revision equals head, and existing foreign keys/indexes remain. Do not query or print any hash values.

- [ ] **Step 5: Run script tests and disposable migration rehearsal**

Run the script unit tests locally. In CI or a disposable local `focusarc_migration_test` database, run `alembic upgrade head` twice followed by `scripts/check_migration.py`. Never point `MIGRATION_DATABASE_URL` at personal or production data for this rehearsal.

- [ ] **Step 6: Commit the task**

```powershell
git add scripts/smoke_deployment.py scripts/check_migration.py scripts/tests/test_smoke_deployment.py
git commit -m "test: smoke check username password sessions"
```

### Task 8: Update Operator and User Documentation

**Files:**
- Modify: `README.md`
- Modify carefully: `docs/deployment.md`
- Modify carefully: `docs/finish-render-setup.md`

**Interfaces:**
- Documents: public registration, private `jayy` initialization, Render/Neon/GitHub changes, PowerShell commands, release order, acceptance checks, and rollback behavior.
- Removes: every operational instruction for shared access keys and personal-mode frontend builds.

- [ ] **Step 1: Inventory obsolete instructions without changing files**

Run:

```powershell
rg -n "PERSONAL_ACCESS|access key|AUTH_MODE|OWNER_USERNAME|VITE_AUTH_MODE|Lock|unlock" README.md docs .env.example backend/.env.example frontend/.env.example render.yaml .github docker-compose.yml
```

Classify each hit as obsolete auth guidance or historical context that must be clearly labeled. Preserve the user's existing fresh-start note and unrelated deployment details.

- [ ] **Step 2: Update README authentication and local-development flow**

Explain that local and hosted environments now use the same public account flow, that anyone with site access can register a separate account, and that passwords are Argon2id hashes. Document `docker compose up --build`, first-account registration, logout, and the disposable test database requirement.

- [ ] **Step 3: Rewrite production setup steps around the new secrets**

Provide exact private PowerShell generation without outputting a real value in documentation:

```powershell
$sessionSecret = py -3.11 -c "import secrets; print(secrets.token_urlsafe(48))"
$sessionSecret | Set-Clipboard
```

Instruct the operator to paste `SESSION_SECRET` only into the Render API environment and store it in a password manager. In GitHub's `production` environment, replace the old shared-key secret with `PRODUCTION_AUTH_PASSWORD` and add `PRODUCTION_AUTH_USERNAME=jayy` as an environment variable. Keep `MIGRATION_DATABASE_URL` and `RENDER_API_KEY` unchanged.

- [ ] **Step 4: Document the exact safe release order**

The runbook must state:

1. Keep `PRODUCTION_DEPLOY_ENABLED=false` while configuring.
2. Back up Neon and verify the restricted runtime role still has `SELECT, INSERT, UPDATE, DELETE` on `users` after migration/default grants.
3. Add `SESSION_SECRET` to Render API; remove shared-key variables only when the new commit is ready.
4. Add GitHub username/password secret and variable privately.
5. Push the tested commit and wait for CI.
6. Enable the deployment switch and run Deploy for the exact successful SHA.
7. Let GitHub migrate, initialize/verify `jayy`, deploy API, run cookie smoke checks, then deploy frontend.
8. Manually test wrong password, `jayy` login, public throwaway registration, logout, direct-route reloads, account isolation, and preserved namespaced counters.
9. Remove obsolete GitHub `PERSONAL_ACCESS_KEY` and Render `PERSONAL_ACCESS_KEY_SHA256`, `AUTH_MODE`, and `OWNER_USERNAME` only after the new release is verified.

Also provide an interactive fallback command that prompts without echo:

```powershell
$env:DATABASE_URL = Read-Host 'Paste the direct Neon owner connection URL'
Set-Location backend
py -3.11 -m app.admin set-initial-password --username jayy
Remove-Item Env:DATABASE_URL
```

- [ ] **Step 5: Document rollback and session-secret handling**

State that rotating `SESSION_SECRET` logs everyone out, old shared-key builds are not compatible with the new frontend, Alembic downgrade is not automatic, and operators must deploy only a schema-compatible commit. Do not place real passwords, hashes, URLs with credentials, or generated secrets in the repository.

- [ ] **Step 6: Re-run the obsolete-instruction inventory**

Run the `rg` command from Step 1. Expected: no active setup instruction references shared access keys or removed variables; any retained occurrence is explicitly marked historical and cannot be followed as current guidance.

- [ ] **Step 7: Commit documentation without staging unrelated files**

```powershell
git add README.md docs/deployment.md docs/finish-render-setup.md
git commit -m "docs: explain account authentication rollout"
```

### Task 9: Full Verification and Production Handoff

**Files:**
- Verify all modified files.
- Do not deploy or mutate production unless the user separately authorizes deployment and all required secrets are available.

**Interfaces:**
- Produces: fresh test/build/migration/image evidence and exact manual production steps.

- [ ] **Step 1: Run the full backend suite on disposable PostgreSQL**

Run with the guarded `TEST_DATABASE_URL` for `focusarc_test`:

```powershell
cd backend
python -m pytest -ra
```

Expected: zero failures and no skipped DB tests when the disposable database is running.

- [ ] **Step 2: Run frontend tests and production build**

```powershell
cd frontend
npm test
npm run build
```

Expected: zero test failures and a successful Vite build.

- [ ] **Step 3: Run deployment tests and migration rehearsal**

```powershell
python -m unittest discover -s scripts/tests -v
```

Run Alembic upgrade twice and `scripts/check_migration.py` only against a separately created disposable migration database. Expected: head is `0003_add_password_hash`, the nullable column exists, and repeated upgrade is idempotent.

- [ ] **Step 4: Validate containers**

Run:

```powershell
docker compose config --quiet
docker build -t focusarc-api:auth ./backend
docker compose -p focusarc-auth-verify up --build -d
docker compose -p focusarc-auth-verify ps
```

Use the separate `focusarc-auth-verify` Compose project only when ports 5173 and 8000 are free. Manually register two temporary users, create distinct timers, verify cross-account separation, log out/in, and confirm each account's counters return. After verification run `docker compose -p focusarc-auth-verify down -v`; this removes only that explicitly named disposable project's containers and volume and leaves the default FocusArc project untouched.

- [ ] **Step 5: Audit every requirement and search for removed auth paths**

Run:

```powershell
rg -n "X-Username|PERSONAL_ACCESS|AUTH_MODE|OWNER_USERNAME|VITE_AUTH_MODE|focusarc.access_key" backend frontend scripts render.yaml .github .env.example README.md docs
git diff --check
git status --short
```

Expected: no executable shared-key/trusted-header path remains, no whitespace errors exist, and unrelated dirty files remain uncommitted unless they were explicitly part of documentation updates.

- [ ] **Step 6: Report evidence and exact production actions**

Summarize created/modified/deleted files, security/data flow, dependencies, test results, and the precise Render, Neon, GitHub, and PowerShell steps still required. Explicitly state that the hosted change is not live unless an exact SHA was deployed and both automated smoke checks and manual acceptance passed.
