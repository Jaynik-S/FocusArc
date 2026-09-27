import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch, AuthenticationError } from "../src/api/apiClient";
import { AuthScreen } from "../src/components/AuthScreen";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const accountError = (code: string, message: string, status: number) =>
  json({ detail: { code, message } }, status);

const fetchMock = vi.fn<typeof fetch>();

const Gate = () => {
  const { status, user, logout } = useAuth();
  if (status === "checking") return <p>Checking session</p>;
  if (status === "anonymous") return <AuthScreen />;
  return (
    <div>
      <p>Private timers for {user?.username}</p>
      <button type="button" onClick={() => void logout()}>Logout</button>
    </div>
  );
};

const renderGate = () => render(<AuthProvider><Gate /></AuthProvider>);

const enterCredentials = async (username = "new.user", password = "password123") => {
  fireEvent.change(await screen.findByLabelText("Username"), { target: { value: username } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("account authentication", () => {
  it("uses a username pattern that modern browsers can compile", async () => {
    fetchMock.mockResolvedValue(json({}, 401));

    renderGate();

    const input = await screen.findByLabelText("Username");
    const pattern = input.getAttribute("pattern");
    expect(pattern).toBeTruthy();
    expect(() => new RegExp(`^(?:${pattern})$`, "v")).not.toThrow();
  });

  it("uses cookies and never browser-supplied identity headers", async () => {
    fetchMock.mockResolvedValue(json({ username: "jayy" }));

    await apiFetch("/auth/session");

    const init = fetchMock.mock.calls[0][1];
    const headers = new Headers(init?.headers);
    expect(init?.credentials).toBe("include");
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.has("X-Username")).toBe(false);
  });

  it("asks for explicit confirmation before registering an unknown username", async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(accountError("username_not_registered", "This username isn't registered", 404))
      .mockResolvedValueOnce(json({ username: "new.user" }, 201));

    renderGate();
    await enterCredentials();

    expect(await screen.findByText("This username isn’t registered. Create a new account?")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Private timers for new.user")).toBeTruthy();
    expect(JSON.parse(fetchMock.mock.calls[2][1]?.body as string)).toEqual({
      username: "new.user",
      password: "password123",
      confirm: true,
    });
  });

  it("signs in an existing account and reports an incorrect password without offering registration", async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(accountError("incorrect_password", "Incorrect password", 401));

    renderGate();
    await enterCredentials("jayy", "wrongpass");

    expect((await screen.findByRole("alert")).textContent).toContain("Incorrect password");
    expect(screen.queryByText(/Create a new account/)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("signs in an existing account with the submitted password", async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ username: "jayy" }));

    renderGate();
    await enterCredentials("JAYY", "password123");

    expect(await screen.findByText("Private timers for jayy")).toBeTruthy();
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toEqual({
      username: "JAYY",
      password: "password123",
    });
  });

  it("shows duplicate registration errors without signing in", async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(accountError("username_not_registered", "This username isn't registered", 404))
      .mockResolvedValueOnce(accountError("username_unavailable", "This username is unavailable", 409));

    renderGate();
    await enterCredentials();
    fireEvent.click(await screen.findByRole("button", { name: "Create account" }));

    expect((await screen.findByRole("alert")).textContent).toContain("This username is unavailable");
    expect(screen.queryByText("Private timers for new.user")).toBeNull();
  });

  it("logs out without removing saved account counters", async () => {
    localStorage.setItem("coursetimers.accounts.jayy.timerElapsed", '{"timer":42}');
    fetchMock
      .mockResolvedValueOnce(json({ username: "jayy" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    renderGate();
    fireEvent.click(await screen.findByRole("button", { name: "Logout" }));

    expect(await screen.findByRole("button", { name: "Continue" })).toBeTruthy();
    expect(localStorage.getItem("coursetimers.accounts.jayy.timerElapsed")).toBe('{"timer":42}');
  });

  it("returns to sign in when an authenticated API request reports session expiry", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ username: "jayy" }))
      .mockResolvedValueOnce(json({}, 401));

    renderGate();
    await screen.findByText("Private timers for jayy");
    await act(async () => {
      await expect(apiFetch("/timers")).rejects.toBeInstanceOf(AuthenticationError);
    });

    await waitFor(() => expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy());
  });
});
