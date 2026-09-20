import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, AuthenticationError, getAccessKey, setAccessKey } from "../src/api/apiClient";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { LockScreen } from "../src/components/LockScreen";
import { useActiveSession } from "../src/hooks/useActiveSession";
import { StrictMode } from "react";
import { TimerRuntimeProvider, useTimerRuntime } from "../src/context/TimerRuntimeContext";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fetchMock = vi.fn<typeof fetch>();
const Gate = () => {
  const { locked, lock } = useAuth();
  return locked ? <LockScreen /> : <button onClick={lock}>Private timers</button>;
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("personal access and recovery", () => {
  it("does not mount the application runtime while a saved key is being validated", async () => {
    setAccessKey("saved-key");
    localStorage.setItem("coursetimers.username", "jayy");
    localStorage.setItem("coursetimers.sessionAdjustments", '{"session":120}');
    fetchMock.mockImplementation(() => new Promise(() => {}));
    render(<MemoryRouter initialEntries={["/timers"]}><App /></MemoryRouter>);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/me$/);
    expect(localStorage.getItem("coursetimers.sessionAdjustments")).toBe('{"session":120}');
  });

  it("cannot unlock from an older successful request after a 401", async () => {
    setAccessKey("saved-key");
    let resolve!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((done) => { resolve = done; }))
      .mockResolvedValueOnce(json({}, 401));
    render(<AuthProvider><Gate /></AuthProvider>);
    await act(async () => { await expect(apiFetch("/timers")).rejects.toBeInstanceOf(AuthenticationError); });
    await act(async () => resolve(json({ username: "jayy" })));
    expect(screen.queryByText("Private timers")).toBeNull();
    expect(getAccessKey()).toBe("");
  });

  it("preserves stored session adjustments during strict-mode mounting", async () => {
    localStorage.setItem("coursetimers.username", "jayy");
    const session = { id: "session", timer_id: "timer", start_at: new Date().toISOString() };
    localStorage.setItem("coursetimers.activeSession", JSON.stringify({ activeSession: session, elapsedSeconds: 0 }));
    localStorage.setItem("coursetimers.sessionAdjustments", '{"session":120}');
    fetchMock.mockImplementation(async () => json({ active_session: session }));
    const { result } = renderHook(() => useTimerRuntime(), {
      wrapper: ({ children }) => <StrictMode><TimerRuntimeProvider>{children}</TimerRuntimeProvider></StrictMode>,
    });
    await waitFor(() => expect(result.current.activeAdjustmentSeconds).toBe(120));
    expect(localStorage.getItem("coursetimers.sessionAdjustments")).toBe('{"session":120}');
  });
  it("validates a saved key before rendering private content, preserves exact owner and counters on lock", async () => {
    setAccessKey("saved-key");
    localStorage.setItem("coursetimers.username", "jayy");
    localStorage.setItem("coursetimers.timerElapsed", '{"timer":42}');
    let resolve!: (response: Response) => void;
    fetchMock.mockImplementation(() => new Promise((done) => { resolve = done; }));
    render(<AuthProvider><Gate /></AuthProvider>);
    expect(screen.queryByText("Private timers")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => resolve(json({ username: "jayy" })));
    fireEvent.click(await screen.findByText("Private timers"));
    expect(screen.queryByText("Private timers")).toBeNull();
    expect(getAccessKey()).toBe("");
    expect(localStorage.getItem("coursetimers.timerElapsed")).toBe('{"timer":42}');
    expect(localStorage.getItem("coursetimers.username")).toBe("jayy");
  });

  it("blocks mismatched cache ownership without erasing data", async () => {
    setAccessKey("saved-key");
    localStorage.setItem("coursetimers.username", "OtherOwner");
    localStorage.setItem("coursetimers.timerElapsed", '{"timer":42}');
    fetchMock.mockResolvedValue(json({ username: "jayy" }));
    render(<AuthProvider><Gate /></AuthProvider>);
    expect((await screen.findByRole("alert")).textContent).toContain("Export the coursetimers.*");
    expect(screen.queryByText("Private timers")).toBeNull();
    expect(localStorage.getItem("coursetimers.username")).toBe("OtherOwner");
    expect(localStorage.getItem("coursetimers.timerElapsed")).toBe('{"timer":42}');
  });

  it("retains credentials and counters on a network failure", async () => {
    setAccessKey("saved-key");
    localStorage.setItem("coursetimers.timerElapsed", '{"timer":42}');
    fetchMock.mockRejectedValue(new TypeError("Network unavailable"));
    render(<AuthProvider><Gate /></AuthProvider>);
    await screen.findByRole("alert");
    expect(getAccessKey()).toBe("saved-key");
    expect(localStorage.getItem("coursetimers.timerElapsed")).toBe('{"timer":42}');
    expect(screen.queryByText("Private timers")).toBeNull();
  });

  it("reactively locks mounted private content on 401 and never sends X-Username", async () => {
    setAccessKey("saved-key");
    localStorage.setItem("coursetimers.username", "jayy");
    localStorage.setItem("coursetimers.timerElapsed", '{"timer":42}');
    fetchMock.mockResolvedValueOnce(json({ username: "jayy" })).mockResolvedValueOnce(json({}, 401));
    render(<AuthProvider><Gate /></AuthProvider>);
    await screen.findByText("Private timers");
    await act(async () => { await expect(apiFetch("/timers")).rejects.toBeInstanceOf(AuthenticationError); });
    expect(screen.queryByText("Private timers")).toBeNull();
    expect(getAccessKey()).toBe("");
    expect(localStorage.getItem("coursetimers.timerElapsed")).toBe('{"timer":42}');
    const headers = new Headers(fetchMock.mock.calls[1][1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer saved-key");
    expect(headers.has("X-Username")).toBe(false);
  });

  it("rejects successful HTML responses instead of treating an error page as data", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Oops</html>", { headers: { "Content-Type": "text/html" } }));
    await expect(apiFetch("/me")).rejects.toThrow("unexpected response");
  });

  it("aborts a caller-cancelled request and never retries a timed out mutation", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    }));
    const controller = new AbortController();
    const cancelled = apiFetch("/me", { signal: controller.signal });
    const cancelledCheck = expect(cancelled).rejects.toBeDefined();
    controller.abort();
    await cancelledCheck;
    const mutation = apiFetch("/stop", { method: "POST", body: {} });
    const timeoutCheck = expect(mutation).rejects.toThrow("too long");
    await vi.advanceTimersByTimeAsync(90_000);
    await timeoutCheck;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("active session polling", () => {
  it("waits for completion before scheduling another poll and pauses hidden tabs", async () => {
    vi.useFakeTimers();
    let resolve!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((done) => { resolve = done; }))
      .mockImplementation(async () => json({ active_session: null }));
    renderHook(() => useActiveSession());
    await act(async () => { await vi.advanceTimersByTimeAsync(45_000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => resolve(json({ active_session: null })));
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("backs off transient failures while retaining the cached session", async () => {
    vi.useFakeTimers();
    const session = { id: "session", timer_id: "timer", start_at: new Date().toISOString() };
    localStorage.setItem("coursetimers.activeSession", JSON.stringify({ activeSession: session, elapsedSeconds: 0 }));
    fetchMock.mockRejectedValue(new Error("Offline"));
    const { result } = renderHook(() => useActiveSession());
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.activeSession?.id).toBe("session");
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops at the saved timestamp after a five-minute suspension and does not replay a failed stop", async () => {
    vi.useFakeTimers();
    const now = Date.now();
    const session = { id: "session", timer_id: "timer", start_at: new Date(now - 600_000).toISOString() };
    localStorage.setItem("coursetimers.activeSession", JSON.stringify({ activeSession: session, elapsedSeconds: 0 }));
    localStorage.setItem("coursetimers.lastActiveAt", JSON.stringify({ sessionId: "session", lastActiveAt: now - 360_000 }));
    fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/stop")) throw new Error("Response lost");
      return json({ active_session: session });
    });
    renderHook(() => useActiveSession());
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    const stops = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/stop"));
    expect(stops).toHaveLength(1);
    expect(JSON.parse(stops[0][1]?.body as string).stopped_at_client).toBe(new Date(now - 360_000).toISOString());
  });
});
