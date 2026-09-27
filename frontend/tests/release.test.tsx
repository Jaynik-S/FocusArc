import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "../src/api/apiClient";
import { TimerRuntimeProvider, useTimerRuntime } from "../src/context/TimerRuntimeContext";
import { useActiveSession } from "../src/hooks/useActiveSession";
import { accountStorageKey } from "../src/storage/accountStorage";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const fetchMock = vi.fn<typeof fetch>();
const key = (suffix: Parameters<typeof accountStorageKey>[1]) =>
  accountStorageKey("jayy", suffix);

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("API request safety", () => {
  it("rejects successful HTML responses instead of treating an error page as data", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>Oops</html>", { headers: { "Content-Type": "text/html" } })
    );
    await expect(apiFetch("/auth/session")).rejects.toThrow("unexpected response");
  });

  it("aborts a caller-cancelled request and never retries a timed out mutation", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    }));
    const controller = new AbortController();
    const cancelled = apiFetch("/auth/session", { signal: controller.signal });
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

describe("account-scoped active session polling", () => {
  it("preserves stored session adjustments during strict-mode mounting", async () => {
    const session = { id: "session", timer_id: "timer", start_at: new Date().toISOString() };
    localStorage.setItem(key("activeSession"), JSON.stringify({ activeSession: session, elapsedSeconds: 0 }));
    localStorage.setItem(key("sessionAdjustments"), '{"session":120}');
    fetchMock.mockImplementation(async () => json({ active_session: session }));
    const { result } = renderHook(() => useTimerRuntime(), {
      wrapper: ({ children }) => (
        <StrictMode><TimerRuntimeProvider username="jayy">{children}</TimerRuntimeProvider></StrictMode>
      ),
    });
    await waitFor(() => expect(result.current.activeAdjustmentSeconds).toBe(120));
    expect(localStorage.getItem(key("sessionAdjustments"))).toBe('{"session":120}');
  });

  it("waits for completion before scheduling another poll and pauses hidden tabs", async () => {
    vi.useFakeTimers();
    let resolve!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((done) => { resolve = done; }))
      .mockImplementation(async () => json({ active_session: null }));
    renderHook(() => useActiveSession("jayy"));
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

  it("backs off transient failures while retaining the account cache", async () => {
    vi.useFakeTimers();
    const session = { id: "session", timer_id: "timer", start_at: new Date().toISOString() };
    localStorage.setItem(key("activeSession"), JSON.stringify({ activeSession: session, elapsedSeconds: 0 }));
    fetchMock.mockRejectedValue(new Error("Offline"));
    const { result } = renderHook(() => useActiveSession("jayy"));
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
    localStorage.setItem(key("activeSession"), JSON.stringify({ activeSession: session, elapsedSeconds: 0 }));
    localStorage.setItem(key("lastActiveAt"), JSON.stringify({ sessionId: "session", lastActiveAt: now - 360_000 }));
    fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/stop")) throw new Error("Response lost");
      return json({ active_session: session });
    });
    renderHook(() => useActiveSession("jayy"));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    const stops = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/stop"));
    expect(stops).toHaveLength(1);
    expect(JSON.parse(stops[0][1]?.body as string).stopped_at_client).toBe(
      new Date(now - 360_000).toISOString()
    );
  });
});
