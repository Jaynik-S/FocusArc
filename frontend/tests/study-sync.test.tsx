import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimerRuntimeProvider, useTimerRuntime, useTimerRuntimeState } from "../src/context/TimerRuntimeContext";
import { STUDY_DATA_CHANGED_EVENT, notifyStudyDataChanged } from "../src/api/dataEvents";
import { getStudyRevision, getStudySnapshot } from "../src/api/studySyncState";
import { createServerClock } from "../src/utils/serverClock";
import { useStudySync } from "../src/hooks/useStudySync";
import { apiFetch, AUTHENTICATION_REQUIRED_EVENT } from "../src/api/apiClient";
import { getStudyAccount, registerStudySync } from "../src/api/studySyncState";
import type { Session, StudySnapshot } from "../src/api/types";

const session: Session = { id: "s1", timer_id: "t1", start_at: "2026-10-25T14:00:00Z", end_at: null, duration_seconds: null, day_date: "2026-10-25", day_of_week: 6, client_tz: "America/Toronto" };
const snapshot = (revision = 1, active: Session | null = session): StudySnapshot => ({
  username: "sync", changed: true, revision, server_now: "2026-10-25T14:01:00Z", study_timezone: "America/Toronto", day_date: "2026-10-25",
  day_start_at: "2026-10-25T04:00:00Z", day_end_at: "2026-10-26T04:00:00Z", lease_expires_at: "2026-10-25T14:06:00Z", active_session: active,
  timers: [{ id: "t1", name: "Math", color: "#ffffff", icon: "book", cycle_total_seconds: 9999, completed_today_seconds: 300, is_archived: false, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" }],
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fetchMock = vi.fn<typeof fetch>();
const wrapper = ({ children }: { children: React.ReactNode }) => <TimerRuntimeProvider username="sync">{children}</TimerRuntimeProvider>;
beforeEach(() => { localStorage.clear(); fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); Object.defineProperty(document, "hidden", { configurable: true, value: false }); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("server calibrated clock", () => {
  it("uses monotonic time and a low latency sample despite wall clock skew", () => {
    let monotonic = 100;
    const clock = createServerClock(() => monotonic);
    clock.sample("2026-10-25T14:01:00Z", 80, 100);
    monotonic = 1100;
    vi.spyOn(Date, "now").mockReturnValue(0);
    expect(clock.now()).toBe(Date.parse("2026-10-25T14:01:01.010Z"));
    clock.sample("2026-10-25T14:05:00Z", 100, 1100);
    expect(clock.now()).toBe(Date.parse("2026-10-25T14:01:01.010Z"));
    vi.restoreAllMocks();
  });
});

describe("study sync coordinator", () => {
  it("does not rerender stable runtime consumers when only the server clock ticks", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async (url) => json(String(url).includes("study-heartbeat") ? {} : snapshot()));
    let liveRenders = 0;
    let stableRenders = 0;
    const LiveClock = () => {
      liveRenders++;
      return <output aria-label="Live clock">{useTimerRuntime().nowMs}</output>;
    };
    const StableState = () => {
      stableRenders++;
      return <output aria-label="Stable revision">{useTimerRuntimeState().revision}</output>;
    };
    render(<TimerRuntimeProvider username="sync"><LiveClock /><StableState /></TimerRuntimeProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.getByLabelText("Stable revision").textContent).toBe("1");
    const liveBeforeTick = liveRenders;
    const stableBeforeTick = stableRenders;
    await act(async () => { await vi.advanceTimersByTimeAsync(1_100); });
    expect(liveRenders).toBeGreaterThan(liveBeforeTick);
    expect(stableRenders).toBe(stableBeforeTick);
  });

  it("applies a start response before its authoritative reconciliation finishes", async () => {
    let reads = 0;
    let starts = 0;
    let finishReconciliation!: (response: Response) => void;
    fetchMock.mockImplementation(async (url) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith("/start")) { starts++; return json({ active_session: session }); }
      if (path.endsWith("/study-heartbeat")) return json({});
      reads++;
      if (reads === 1) return json(snapshot(1, null));
      return new Promise((resolve) => { finishReconciliation = resolve; });
    });
    const hook = renderHook(() => useTimerRuntime(), { wrapper });
    await waitFor(() => expect(hook.result.current.revision).toBe(1));
    let starting!: Promise<void>;
    act(() => { starting = hook.result.current.startTimer("t1"); });
    await waitFor(() => expect(finishReconciliation).toBeTypeOf("function"));
    expect(hook.result.current.activeSession?.id).toBe("s1");
    expect(hook.result.current.busy).toBe(true);
    await act(async () => { finishReconciliation(json(snapshot(2))); await starting; });
    expect(hook.result.current.revision).toBe(2);
    expect(hook.result.current.busy).toBe(false);
    expect(starts).toBe(1);
    expect(reads).toBe(2);
  });

  it("applies active state and daily counters atomically and invalidates remote history changes", async () => {
    let current = snapshot();
    fetchMock.mockImplementation(async (url) => json(String(url).includes("study-heartbeat") ? {} : current));
    const changed = vi.fn(); window.addEventListener(STUDY_DATA_CHANGED_EVENT, changed);
    const hook = renderHook(() => useTimerRuntime(), { wrapper });
    await waitFor(() => expect(hook.result.current.revision).toBe(1));
    expect(hook.result.current.elapsedByTimer.t1).toBe(300);
    expect(hook.result.current.elapsedSeconds).toBe(60);
    current = { ...snapshot(2), timers: [{ ...snapshot().timers[0], completed_today_seconds: 600 }] };
    await act(async () => { await hook.result.current.refresh(); });
    expect(hook.result.current.activeSession?.id).toBe("s1");
    expect(hook.result.current.elapsedByTimer.t1).toBe(600);
    expect(changed).toHaveBeenCalledTimes(2);
    current = snapshot(1, null);
    await act(async () => { await hook.result.current.refresh(); });
    expect(hook.result.current.activeSession?.id).toBe("s1");
    expect(hook.result.current.revision).toBe(2);
    window.removeEventListener(STUDY_DATA_CHANGED_EVENT, changed);
  });

  it("coalesces reads and discards an invalidated in-flight snapshot before a fresh read", async () => {
    let finish!: (r: Response) => void; let reads = 0;
    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes("study-heartbeat")) return json({});
      reads++;
      if (reads === 1) return new Promise((resolve) => { finish = resolve; });
      return json(snapshot(2, null));
    });
    const hook = renderHook(() => useTimerRuntime(), { wrapper });
    act(() => notifyStudyDataChanged());
    await act(async () => { finish(json(snapshot(1))); });
    await waitFor(() => expect(hook.result.current.revision).toBe(2));
    expect(reads).toBe(2); expect(hook.result.current.activeSession).toBeNull();
  });

  it("guards commands, refreshes an uncertain outcome, and never replays the mutation", async () => {
    let posts = 0; let current = snapshot(); let body: Record<string, unknown> = {};
    fetchMock.mockImplementation(async (url, init) => {
      if (new URL(String(url)).pathname.endsWith("/stop")) { posts++; body = JSON.parse(String(init?.body)); current = snapshot(2, null); throw new Error("Response lost"); }
      return json(String(url).includes("study-heartbeat") ? {} : current);
    });
    const hook = renderHook(() => useTimerRuntime(), { wrapper });
    await waitFor(() => expect(hook.result.current.revision).toBe(1));
    await act(async () => { await expect(hook.result.current.stopTimer()).rejects.toThrow("Response lost"); });
    expect(body).toEqual({ expected_revision: 1, expected_active_session_id: "s1" });
    expect(hook.result.current.activeSession).toBeNull(); expect(posts).toBe(1);
  });

  it("heartbeats while hidden and never sends a browser inactivity stop", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async (url) => json(String(url).includes("study-heartbeat") ? {} : snapshot()));
    const hook = renderHook(() => useTimerRuntime(), { wrapper });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => { await vi.advanceTimersByTimeAsync(360_000); });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("study-heartbeat")).length).toBeGreaterThan(5);
    expect(fetchMock.mock.calls.some(([url]) => new URL(String(url)).pathname.endsWith("/stop"))).toBe(false);
    expect(hook.result.current.activeSession?.id).toBe("s1");
  });

  it("clears the bridge on account switch and rejects the old account response", async () => {
    let finish!: (r: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockImplementation(async (url) => json(String(url).includes("study-heartbeat") ? {} : { ...snapshot(7, null), username: "new" }));
    const hook = renderHook(({ username }) => useStudySync(username), { initialProps: { username: "old" } });
    hook.rerender({ username: "new" });
    await waitFor(() => expect(getStudyRevision("new")).toBe(7));
    await act(async () => { finish(json({ ...snapshot(99), username: "old" })); });
    expect(getStudyRevision("old")).toBeNull(); expect(getStudySnapshot("new")?.revision).toBe(7);
  });

  it("mounts safely in strict mode without importing legacy drafts", async () => {
    localStorage.setItem("coursetimers.accounts.sync.sessionAdjustments", '{"s1":600}');
    fetchMock.mockImplementation(async (url) => json(String(url).includes("study-heartbeat") ? {} : snapshot()));
    const hook = renderHook(() => useTimerRuntime(), { wrapper: ({ children }) => <StrictMode><TimerRuntimeProvider username="sync">{children}</TimerRuntimeProvider></StrictMode> });
    await waitFor(() => expect(hook.result.current.revision).toBe(1));
    expect(hook.result.current.activeAdjustmentSeconds).toBe(0);
    expect(hook.result.current.legacyPendingAdjustments.s1).toBe(600);
    expect(fetchMock.mock.calls.some(([url]) => new URL(String(url)).pathname.endsWith("/adjust"))).toBe(false);
  });

  it("uses Toronto and current account guards for start and reset without client timestamps", async () => {
    let current = snapshot(1, null);
    const commands: Array<{ path: string; body: unknown }> = [];
    fetchMock.mockImplementation(async (url, init) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith("/start")) { commands.push({ path, body: JSON.parse(String(init?.body)) }); current = snapshot(2); return json({ active_session: session }); }
      if (path.endsWith("/totals/reset")) { commands.push({ path, body: JSON.parse(String(init?.body)) }); current = snapshot(3, null); return json({ totals: [] }); }
      return json(path.endsWith("/study-heartbeat") ? {} : current);
    });
    const hook = renderHook(() => useTimerRuntime(), { wrapper });
    await waitFor(() => expect(hook.result.current.revision).toBe(1));
    await act(async () => { await hook.result.current.startTimer("t1"); });
    await act(async () => { await hook.result.current.resetTotals(); });
    expect(commands).toEqual([
      { path: "/api/timers/t1/start", body: { client_tz: "America/Toronto", expected_revision: 1, expected_active_session_id: null } },
      { path: "/api/totals/reset", body: { expected_revision: 2, expected_active_session_id: "s1" } },
    ]);
    expect(hook.result.current.elapsedByTimer.t1).toBe(300);
  });

  it("retains atomic data for unchanged snapshots and clips a previous-day active interval at Toronto midnight", async () => {
    let current: Record<string, unknown> = { ...snapshot(), active_session: { ...session, start_at: "2026-10-24T23:00:00Z" }, server_now: "2026-10-25T04:01:00Z" };
    fetchMock.mockImplementation(async (url) => json(String(url).includes("study-heartbeat") ? {} : current));
    const hook = renderHook(() => useTimerRuntime(), { wrapper });
    await waitFor(() => expect(hook.result.current.revision).toBe(1));
    expect(hook.result.current.elapsedSeconds).toBe(60);
    current = { ...snapshot(), changed: false, active_session: undefined, timers: undefined, server_now: "2026-10-25T04:01:00Z" };
    await act(async () => { await hook.result.current.refresh(); });
    expect(hook.result.current.activeSession?.id).toBe("s1");
    expect(hook.result.current.elapsedByTimer.t1).toBe(300);
    expect(hook.result.current.today).toBe("2026-10-25");
  });

  it("stops polling and heartbeats after authentication expires", async () => {
    vi.useFakeTimers(); let unauthorized = false;
    fetchMock.mockImplementation(async () => unauthorized ? json({ detail: "Sign in" }, 401) : json(snapshot()));
    const hook = renderHook(() => useTimerRuntime(), { wrapper });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    unauthorized = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    const requests = fetchMock.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(fetchMock.mock.calls).toHaveLength(requests);
    expect(hook.result.current.activeSession).toBeNull();
    expect(getStudyRevision()).toBeNull();
    expect(hook.result.current.synced).toBe(false);
  });

  it("recalibrates on resume without using a changed wall clock to stop or extend study", async () => {
    let current = snapshot();
    fetchMock.mockImplementation(async (url) => json(String(url).includes("study-heartbeat") ? {} : current));
    const hook = renderHook(() => useTimerRuntime(), { wrapper });
    await waitFor(() => expect(hook.result.current.revision).toBe(1));
    vi.spyOn(Date, "now").mockReturnValue(0);
    current = { ...snapshot(), server_now: "2026-10-25T14:10:00Z" };
    await act(async () => { window.dispatchEvent(new Event("pageshow")); });
    await waitFor(() => expect(hook.result.current.elapsedSeconds).toBe(600));
    expect(fetchMock.mock.calls.some(([url]) => new URL(String(url)).pathname.endsWith("/stop"))).toBe(false);
    vi.restoreAllMocks();
  });

  it("keeps controls unavailable when the initial clock sample is too slow to calibrate", async () => {
    let monotonic = 0; let finish!: (response: Response) => void;
    vi.spyOn(performance, "now").mockImplementation(() => monotonic);
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValue(json({}));
    const hook = renderHook(() => useTimerRuntime(), { wrapper });
    monotonic = 5_000;
    await act(async () => { finish(json(snapshot())); });
    expect(hook.result.current.synced).toBe(false);
    await act(async () => { await expect(hook.result.current.startTimer("t1")).rejects.toThrow(/sync/i); });
    expect(fetchMock.mock.calls.some(([url]) => new URL(String(url)).pathname.endsWith("/start"))).toBe(false);
    vi.restoreAllMocks();
  });

  it("marks the retained snapshot stale immediately when connectivity is lost", async () => {
    fetchMock.mockImplementation(async (url) => json(String(url).includes("study-heartbeat") ? {} : snapshot()));
    const hook = renderHook(() => useTimerRuntime(), { wrapper });
    await waitFor(() => expect(hook.result.current.synced).toBe(true));
    act(() => window.dispatchEvent(new Event("offline")));
    expect(hook.result.current.synced).toBe(false);
    expect(hook.result.current.elapsedByTimer.t1).toBe(300);
    await act(async () => { await expect(hook.result.current.stopTimer()).rejects.toThrow(/sync/i); });
  });

  it("drains the stale read and the queued post-mutation snapshot before resolving the command", async () => {
    let current = snapshot(); let finish!: (response: Response) => void; let delay = false;
    fetchMock.mockImplementation(async (url) => {
      if (new URL(String(url)).pathname.endsWith("/stop")) { current = snapshot(2, null); return json({ stopped_session: session }); }
      if (String(url).includes("study-heartbeat")) return json({});
      if (delay) { delay = false; return new Promise((resolve) => { finish = resolve; }); }
      return json(current);
    });
    const hook = renderHook(() => useTimerRuntime(), { wrapper });
    await waitFor(() => expect(hook.result.current.revision).toBe(1));
    delay = true; let reading!: Promise<void>; let stopping!: Promise<void>;
    act(() => { reading = hook.result.current.refresh(); });
    act(() => { stopping = hook.result.current.stopTimer(); });
    await act(async () => { finish(json(snapshot())); await reading; await stopping; });
    expect(hook.result.current.revision).toBe(2);
    expect(hook.result.current.activeSession).toBeNull();
    expect(hook.result.current.busy).toBe(false);
  });

  it.each([0, 1, 2])("rejects another account's full snapshot at revision %s before comparing revisions", async (revision) => {
    let current = snapshot();
    fetchMock.mockImplementation(async (url) => json(String(url).includes("study-heartbeat") ? {} : current));
    const hook = renderHook(() => useTimerRuntime(), { wrapper });
    await waitFor(() => expect(hook.result.current.revision).toBe(1));
    const authenticationRequired = vi.fn(); window.addEventListener(AUTHENTICATION_REQUIRED_EVENT, authenticationRequired);
    current = { ...snapshot(revision), username: "another-account" };
    await act(async () => { await hook.result.current.refresh(); });
    expect(hook.result.current.revision).toBeNull();
    expect(hook.result.current.snapshotTimers).toEqual([]);
    expect(getStudyAccount()).toBeNull();
    expect(authenticationRequired).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTHENTICATION_REQUIRED_EVENT, authenticationRequired);
  });

  it.each([0, 1, 2])("rejects another account's unchanged snapshot at revision %s", async (revision) => {
    let current: Record<string, unknown> = snapshot();
    fetchMock.mockImplementation(async (url) => json(String(url).includes("study-heartbeat") ? {} : current));
    const hook = renderHook(() => useTimerRuntime(), { wrapper });
    await waitFor(() => expect(hook.result.current.revision).toBe(1));
    current = { ...snapshot(revision), username: "another-account", changed: false, active_session: undefined, timers: undefined };
    await act(async () => { await hook.result.current.refresh(); });
    expect(hook.result.current.activeSession).toBeNull();
    expect(getStudyAccount()).toBeNull();
    expect(hook.result.current.synced).toBe(false);
  });

  it("blocks an account-switched mutation before another account's state can be applied", async () => {
    let commands = 0; let commandUrl: URL | null = null;
    fetchMock.mockImplementation(async (url) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.pathname.endsWith("/stop")) {
        commands++; commandUrl = requestUrl;
        return json({ detail: { code: "account_changed", message: "Account changed. Sign in again." } }, 409);
      }
      return json(requestUrl.pathname.endsWith("/study-heartbeat") ? {} : snapshot());
    });
    const hook = renderHook(() => useTimerRuntime(), { wrapper });
    await waitFor(() => expect(hook.result.current.revision).toBe(1));
    await act(async () => { await expect(hook.result.current.stopTimer()).rejects.toMatchObject({ status: 409, code: "account_changed" }); });
    expect(commandUrl!.searchParams.get("expected_username")).toBe("sync");
    expect(getStudyAccount()).toBeNull();
    expect(hook.result.current.revision).toBeNull();
    expect(commands).toBe(1);
  });
});

describe("study API account guard", () => {
  it("binds all study requests to the registered account while preserving query parameters and cookie authentication", async () => {
    const registration = registerStudySync("Account + Name", async () => {});
    fetchMock.mockImplementation(async () => json({}));
    try {
      await apiFetch("/sessions?from=2026-10-01&to=2026-10-25&expected_revision=4&expected_username=other");
      await apiFetch("/timers", { method: "POST", body: { name: "Math" } });
      await apiFetch("/study-state?known_revision=4&known_day=2026-10-25");
      await apiFetch("/auth/session");
      await apiFetch("/health");
      const urls = fetchMock.mock.calls.map(([url]) => new URL(String(url)));
      expect(urls.slice(0, 3).map((url) => url.searchParams.get("expected_username"))).toEqual(["Account + Name", "Account + Name", "Account + Name"]);
      expect(urls[0].searchParams.get("from")).toBe("2026-10-01");
      expect(urls[0].searchParams.get("expected_revision")).toBe("4");
      expect(urls[2].searchParams.get("known_day")).toBe("2026-10-25");
      expect(urls.slice(3).map((url) => url.searchParams.has("expected_username"))).toEqual([false, false]);
      expect(fetchMock.mock.calls.every(([, init]) => init?.credentials === "include")).toBe(true);
      expect(fetchMock.mock.calls.every(([, init]) => !new Headers(init?.headers).has("Authorization"))).toBe(true);
    } finally { registration.clear(); }
  });
});
