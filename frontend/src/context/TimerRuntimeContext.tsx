import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { apiFetch } from "../api/apiClient";
import { adjustStudySession } from "../api/sessionAdjustments";
import type { Session } from "../api/types";
import { useStudySync } from "../hooks/useStudySync";
import { storageForAccount } from "../storage/accountStorage";

type TimerRuntimeContextValue = ReturnType<typeof useStudySync> & {
  offsets: Record<string, number>;
  activeAdjustmentSeconds: number;
  legacyPendingAdjustments: Record<string, number>;
  legacyPendingOffsets: Record<string, number>;
  resetRuntimeState: () => void;
  adjustOffset: (timerId: string, deltaSeconds: number) => Promise<void>;
  applyLegacyAdjustment: (session: Session, deltaSeconds: number) => Promise<void>;
};
type TimerRuntimeStateValue = Omit<TimerRuntimeContextValue, "nowMs" | "elapsedSeconds">;

const readLegacyDraft = (username: string, key: "sessionAdjustments" | "timerOffsets") => {
  try {
    const parsed = JSON.parse(storageForAccount(username).getItem(key) ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] !== 0));
  } catch { return {}; }
};

const TimerRuntimeContext = createContext<TimerRuntimeContextValue | undefined>(undefined);
const TimerRuntimeStateContext = createContext<TimerRuntimeStateValue | undefined>(undefined);
const EMPTY_OFFSETS: Record<string, number> = {};

export const TimerRuntimeProvider = ({ children, username }: { children: React.ReactNode; username: string }) => {
  const sync = useStudySync(username);
  const [adjusting, setAdjusting] = useState(false);
  const adjustingRef = useRef(false);
  const [draftRevision, setDraftRevision] = useState(0);
  const legacyPendingAdjustments = useMemo(() => readLegacyDraft(username, "sessionAdjustments"), [username, draftRevision]);
  const legacyPendingOffsets = useMemo(() => readLegacyDraft(username, "timerOffsets"), [username, draftRevision]);
  const adjustOffset = useCallback(async (timerId: string, deltaSeconds: number) => {
    if (adjustingRef.current || sync.busy) return;
    if (!sync.synced) throw new Error("Reconnect and sync before adjusting a session.");
    adjustingRef.current = true;
    setAdjusting(true);
    try {
      const session = sync.activeSession?.timer_id === timerId ? sync.activeSession : await apiFetch<Session | null>(`/timers/${timerId}/latest-session`);
      if (!session) throw new Error("Start this timer before adjusting its duration.");
      await adjustStudySession(session, deltaSeconds);
    } finally { adjustingRef.current = false; setAdjusting(false); }
  }, [sync.activeSession, sync.busy, sync.synced]);
  const applyLegacyAdjustment = useCallback(async (session: Session, deltaSeconds: number) => {
    if (adjustingRef.current || sync.busy) throw new Error("Wait for the current study action to finish.");
    if (!sync.synced) throw new Error("Reconnect and sync before recovering an adjustment.");
    adjustingRef.current = true;
    setAdjusting(true);
    try {
      await adjustStudySession(session, deltaSeconds);
      const remaining = readLegacyDraft(username, "sessionAdjustments");
      delete remaining[session.id];
      try { storageForAccount(username).setItem("sessionAdjustments", JSON.stringify(remaining)); } catch { /* Draft storage is optional. */ }
      setDraftRevision((revision) => revision + 1);
    } finally { adjustingRef.current = false; setAdjusting(false); }
  }, [username, sync.busy, sync.synced]);
  const startTimer = useCallback(async (timerId: string) => {
    if (adjustingRef.current) throw new Error("Wait for the current adjustment to finish.");
    await sync.startTimer(timerId);
  }, [sync.startTimer]);
  const stopTimer = useCallback(async () => {
    if (adjustingRef.current) throw new Error("Wait for the current adjustment to finish.");
    await sync.stopTimer();
  }, [sync.stopTimer]);
  const resetTotals = useCallback(async () => {
    if (adjustingRef.current) throw new Error("Wait for the current adjustment to finish.");
    return sync.resetTotals();
  }, [sync.resetTotals]);
  // Runtime counters are always authoritative. Reset only asks for a fresh snapshot.
  const resetRuntimeState = useCallback(() => { void sync.refresh().catch(() => {}); }, [sync.refresh]);
  const stateValue = useMemo<TimerRuntimeStateValue>(() => ({
    activeSession: sync.activeSession, snapshotTimers: sync.snapshotTimers, revision: sync.revision,
    elapsedByTimer: sync.elapsedByTimer, today: sync.today, timeZone: sync.timeZone,
    loading: sync.loading, busy: sync.busy || adjusting, error: sync.error, synced: sync.synced,
    refresh: sync.refresh, offsets: EMPTY_OFFSETS, activeAdjustmentSeconds: 0,
    legacyPendingAdjustments, legacyPendingOffsets, adjustOffset, applyLegacyAdjustment,
    resetRuntimeState, startTimer, stopTimer, resetTotals,
  }), [
    sync.activeSession, sync.snapshotTimers, sync.revision, sync.elapsedByTimer, sync.today, sync.timeZone,
    sync.loading, sync.busy, sync.error, sync.synced, sync.refresh, adjusting,
    legacyPendingAdjustments, legacyPendingOffsets, adjustOffset, applyLegacyAdjustment,
    resetRuntimeState, startTimer, stopTimer, resetTotals,
  ]);
  const value = useMemo<TimerRuntimeContextValue>(() => ({
    ...stateValue, nowMs: sync.nowMs, elapsedSeconds: sync.elapsedSeconds,
  }), [stateValue, sync.nowMs, sync.elapsedSeconds]);
  return <TimerRuntimeStateContext.Provider value={stateValue}>
    <TimerRuntimeContext.Provider value={value}>{children}</TimerRuntimeContext.Provider>
  </TimerRuntimeStateContext.Provider>;
};

export const useOptionalTimerRuntime = () => useContext(TimerRuntimeContext);
export const useTimerRuntime = () => {
  const context = useOptionalTimerRuntime();
  if (!context) throw new Error("useTimerRuntime must be used within TimerRuntimeProvider");
  return context;
};

export const useOptionalTimerRuntimeState = () => useContext(TimerRuntimeStateContext);
export const useTimerRuntimeState = () => {
  const context = useOptionalTimerRuntimeState();
  if (!context) throw new Error("useTimerRuntimeState must be used within TimerRuntimeProvider");
  return context;
};
