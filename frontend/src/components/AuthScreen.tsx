import { FormEvent, useState } from "react";

import { ApiError } from "../api/apiClient";
import { useAuth } from "../contexts/AuthContext";

const errorMessage = (cause: unknown) => {
  if (cause instanceof ApiError) {
    if (cause.code === "rate_limited" && cause.retryAfter) {
      return `${cause.message} Try again in ${cause.retryAfter} seconds.`;
    }
    return cause.message;
  }
  return cause instanceof Error
    ? cause.message
    : "The account request could not be completed. Try again.";
};

export const AuthScreen = () => {
  const { login, register } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmRegistration, setConfirmRegistration] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    setConfirmRegistration(false);
    try {
      const result = await login(username, password);
      if (result === "registration_required") setConfirmRegistration(true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  };

  const createAccount = async () => {
    setPending(true);
    setError("");
    try {
      await register(username, password);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="auth-title">
        <h1 id="auth-title">FocusArc</h1>
        <p>Sign in to your timers</p>
        <form onSubmit={submit} className="auth-form">
          <label className="field">
            Username
            <input
              aria-label="Username"
              autoComplete="username"
              autoFocus
              disabled={pending || confirmRegistration}
              maxLength={32}
              pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,31}"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label className="field">
            Password
            <input
              aria-label="Password"
              autoComplete="current-password"
              disabled={pending || confirmRegistration}
              minLength={8}
              maxLength={128}
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {!confirmRegistration ? (
            <button className="primary" disabled={pending} type="submit">
              {pending ? "Checking…" : "Continue"}
            </button>
          ) : (
            <div className="auth-confirmation">
              <p>This username isn’t registered. Create a new account?</p>
              <div className="auth-actions">
                <button className="primary" disabled={pending} onClick={() => void createAccount()} type="button">
                  {pending ? "Creating…" : "Create account"}
                </button>
                <button className="ghost" disabled={pending} onClick={() => setConfirmRegistration(false)} type="button">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {error ? <p className="error" role="alert">{error}</p> : null}
        </form>
        <p className="auth-public-note">
          Registration is public. Anyone who can reach this site can create a separate account.
        </p>
      </section>
    </main>
  );
};
