import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, AuthenticationError, AUTHENTICATION_REQUIRED_EVENT } from "../api/apiClient";
import { notifyStudySnapshotApplied, STUDY_DATA_CHANGED_EVENT } from "../api/dataEvents";
import { registerStudySync } from "../api/studySyncState";
import type { ResetTotalsResponse, StudySnapshot, StudyStateResponse } from "../api/types";
import { createServerClock } from "../utils/serverClock";

const TIME_ZONE = "America/Toronto";
type SyncControls = {
  refresh: (invalidate?: boolean) => Promise<void>;
  mutate: <T>(path: string, body?: Record<string, unknown>) => Promise<T>;
};
type SyncView = { username: string; snapshot: StudySnapshot | null; nowMs: number; loading: boolean; synced: boolean; error: string | null; busy: boolean };
const emptyView = (username: string): SyncView => ({ username, snapshot: null, nowMs: 0, loading: Boolean(username), synced: false, error: null, busy: false });

export const useStudySync = (username = "") => {
  const [view, setView] = useState<SyncView>(() => emptyView(username));
  const controls = useRef<SyncControls | null>(null);

  useEffect(() => {
    setView(emptyView(username));
    if (!username) { controls.current = null; return; }
    const clock = createServerClock();
    const controller = new AbortController();
    let snapshot: StudySnapshot | null = null;
    let disposed = false;
    let denied = false;
    let generation = 0;
    let queued = false;
    let inFlight: Promise<void> | null = null;
    let mutation = false;
    let heartbeatRunning = false;
    let failures = 0;
    let synchronized = false;
    let offline = navigator.onLine === false;
    let pollTimer: number | undefined;
    let tickTimer: number | undefined;
    let lastWall = Date.now();
    let lastMonotonic = performance.now();
    const current = () => !disposed && !denied;
    const update = (values: Partial<SyncView>) => {
      if (current()) setView((previous) => ({ ...previous, ...values }));
    };
    const schedulePoll = () => {
      window.clearTimeout(pollTimer);
      if (current() && !document.hidden) {
        pollTimer = window.setTimeout(() => { void refresh().catch(() => {}); }, Math.min(2_000 * 2 ** failures, 30_000));
      }
    };
    const heartbeat = async () => {
      if (!current() || heartbeatRunning || !snapshot?.active_session) return;
      heartbeatRunning = true;
      try {
        await apiFetch("/study-heartbeat", { method: "POST", body: { active_session_id: snapshot.active_session.id }, signal: controller.signal });
      } catch (cause) {
        if (current() && !(cause instanceof AuthenticationError)) {
          update({ synced: false, error: "Cannot sync with the API. Reconnecting automatically." });
          synchronized = false;
          void refresh(true).catch(() => {});
        }
      } finally { heartbeatRunning = false; }
    };
    const refresh = (invalidate = false): Promise<void> => {
      if (!current()) return Promise.resolve();
      if (invalidate) { generation++; queued = true; }
      if (inFlight) return inFlight;
      const request = async () => {
        do {
          queued = false;
          const requestedGeneration = generation;
          const known = snapshot;
          const query = known ? `?known_revision=${known.revision}&known_day=${encodeURIComponent(known.day_date)}` : "";
          const sentAt = performance.now();
          try {
            const response = await apiFetch<StudyStateResponse>(`/study-state${query}`, { signal: controller.signal });
            if (!current()) return;
            if (response.username !== username) {
              window.dispatchEvent(new Event(AUTHENTICATION_REQUIRED_EVENT));
              return;
            }
            if (requestedGeneration !== generation || mutation) continue;
            if (snapshot && response.revision < snapshot.revision) continue;
            const full = response.active_session !== undefined && Array.isArray(response.timers);
            if (!full && (!snapshot || response.revision !== snapshot.revision || response.day_date !== snapshot.day_date)) {
              throw new Error("The server did not return a complete study snapshot.");
            }
            const previous = snapshot;
            snapshot = { ...snapshot, ...response, active_session: full ? response.active_session! : snapshot!.active_session, timers: full ? response.timers! : snapshot!.timers };
            clock.sample(response.server_now, sentAt);
            synchronized = !offline && clock.isCalibrated();
            registration.apply(snapshot);
            failures = 0;
            update({ snapshot, nowMs: clock.now(), loading: false, synced: synchronized, error: synchronized ? null : "Calibrating server time. Reconnecting automatically." });
            if (!previous || previous.revision !== snapshot.revision || previous.day_date !== snapshot.day_date) {
              notifyStudySnapshotApplied(snapshot.revision, snapshot.day_date);
            }
            if (snapshot.active_session && (!previous || previous.active_session?.id !== snapshot.active_session.id)) void heartbeat();
          } catch (cause) {
            if (!current()) return;
            failures++;
            synchronized = false;
            update({ loading: false, synced: false, error: "Cannot sync with the API. Reconnecting automatically." });
            if (!queued) throw cause;
          }
        } while (queued && current());
      };
      inFlight = request().finally(() => { inFlight = null; schedulePoll(); });
      return inFlight;
    };
    const registration = registerStudySync(username, () => refresh(true));
    const mutate = async <T,>(path: string, body: Record<string, unknown> = {}): Promise<T> => {
      if (!current() || mutation) throw new Error("Wait for the current study action to finish.");
      if (!snapshot || !synchronized || !clock.isCalibrated()) throw new Error("Reconnect and sync before changing a timer.");
      mutation = true;
      generation++;
      update({ busy: true });
      try {
        return await apiFetch<T>(path, {
          method: "POST", signal: controller.signal,
          body: { ...body, expected_revision: snapshot.revision, expected_active_session_id: snapshot.active_session?.id ?? null },
        });
      } finally {
        mutation = false;
        // A lost response can still mean a committed write. Reconcile once; never replay it.
        await refresh(true).catch(() => {});
        update({ busy: false });
      }
    };
    controls.current = { refresh, mutate };
    const resume = () => {
      clock.recalibrate();
      synchronized = false;
      update({ synced: false });
      if (current() && !document.hidden) void refresh(true).catch(() => {});
    };
    const changed = (event: Event) => {
      if ((event as CustomEvent<{ source?: string }>).detail?.source !== "snapshot") void refresh(true).catch(() => {});
    };
    const online = () => { offline = false; resume(); };
    const wentOffline = () => {
      offline = true;
      synchronized = false;
      update({ synced: false, error: "Offline. Saved study data is retained until reconnecting." });
    };
    const authenticationRequired = () => {
      denied = true;
      controller.abort();
      window.clearTimeout(pollTimer);
      registration.clear();
      setView({ ...emptyView(username), loading: false, error: "Sign in to sync your study data." });
    };
    const visibilityChanged = () => { window.clearTimeout(pollTimer); if (!document.hidden) resume(); };
    const tick = () => {
      if (!current()) return;
      const wall = Date.now();
      const monotonic = performance.now();
      // Wall time detects suspension only. It never contributes seconds to a session.
      if (Math.abs((wall - lastWall) - (monotonic - lastMonotonic)) > 5_000 || monotonic - lastMonotonic > 5_000) resume();
      lastWall = wall; lastMonotonic = monotonic;
      const nowMs = clock.now();
      if (synchronized && !clock.isCalibrated()) {
        synchronized = false;
        update({ synced: false, error: "Calibrating server time. Reconnecting automatically." });
      }
      if (nowMs) update({ nowMs });
      if (snapshot && nowMs >= Date.parse(snapshot.day_end_at)) void refresh().catch(() => {});
      tickTimer = window.setTimeout(tick, nowMs ? 1000 - nowMs % 1000 + 1 : 1000);
    };
    window.addEventListener(STUDY_DATA_CHANGED_EVENT, changed);
    window.addEventListener(AUTHENTICATION_REQUIRED_EVENT, authenticationRequired);
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("online", online);
    window.addEventListener("offline", wentOffline);
    document.addEventListener("visibilitychange", visibilityChanged);
    const heartbeatTimer = window.setInterval(() => { void heartbeat(); }, 30_000);
    tick();
    void refresh().catch(() => {});
    return () => {
      disposed = true;
      controller.abort();
      registration.clear();
      controls.current = null;
      window.clearTimeout(pollTimer); window.clearTimeout(tickTimer); window.clearInterval(heartbeatTimer);
      window.removeEventListener(STUDY_DATA_CHANGED_EVENT, changed);
      window.removeEventListener(AUTHENTICATION_REQUIRED_EVENT, authenticationRequired);
      window.removeEventListener("focus", resume); window.removeEventListener("pageshow", resume); window.removeEventListener("online", online);
      window.removeEventListener("offline", wentOffline);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [username]);

  const refresh = useCallback(async () => { await controls.current?.refresh(); }, []);
  const startTimer = useCallback(async (timerId: string) => { await controls.current?.mutate(`/timers/${timerId}/start`, { client_tz: TIME_ZONE }); }, []);
  const stopTimer = useCallback(async () => { await controls.current?.mutate("/stop"); }, []);
  const resetTotals = useCallback(async () => {
    if (!controls.current) throw new Error("Sign in before resetting totals.");
    return controls.current.mutate<ResetTotalsResponse>("/totals/reset");
  }, []);
  const state = view.username === username ? view : emptyView(username);
  return useMemo(() => {
    const activeSession = state.snapshot?.active_session ?? null;
    const start = activeSession ? Math.max(Date.parse(activeSession.start_at), Date.parse(state.snapshot!.day_start_at)) : 0;
    const end = state.snapshot ? Math.min(state.nowMs, Date.parse(state.snapshot.day_end_at)) : 0;
    return {
      activeSession, elapsedSeconds: activeSession ? Math.max(0, Math.floor((end - start) / 1000)) : 0,
      snapshotTimers: state.snapshot?.timers ?? [], revision: state.snapshot?.revision ?? null,
      elapsedByTimer: Object.fromEntries((state.snapshot?.timers ?? []).map((timer) => [timer.id, timer.completed_today_seconds])),
      nowMs: state.nowMs, today: state.snapshot?.day_date ?? "", timeZone: state.snapshot?.study_timezone ?? TIME_ZONE,
      loading: state.loading, busy: state.busy, error: state.error, synced: state.synced,
      refresh, startTimer, stopTimer, resetTotals,
    };
  }, [state, refresh, startTimer, stopTimer, resetTotals]);
};
