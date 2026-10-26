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

const readLegacyDraft = (username: string, key: "sessionAdjustments" | "timerOffsets") => {
  try {
    const parsed = JSON.parse(storageForAccount(username).getItem(key) ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] !== 0));
  } catch { return {}; }
};

const TimerRuntimeContext = createContext<TimerRuntimeContextValue | undefined>(undefined);

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
  const value = useMemo(() => ({
    ...sync, busy: sync.busy || adjusting, offsets: {}, activeAdjustmentSeconds: 0,
    legacyPendingAdjustments, legacyPendingOffsets, adjustOffset, applyLegacyAdjustment, resetRuntimeState, startTimer, stopTimer, resetTotals,
  }), [sync, adjusting, legacyPendingAdjustments, legacyPendingOffsets, adjustOffset, applyLegacyAdjustment, resetRuntimeState, startTimer, stopTimer, resetTotals]);
  return <TimerRuntimeContext.Provider value={value}>{children}</TimerRuntimeContext.Provider>;
};

export const useOptionalTimerRuntime = () => useContext(TimerRuntimeContext);
export const useTimerRuntime = () => {
  const context = useOptionalTimerRuntime();
  if (!context) throw new Error("useTimerRuntime must be used within TimerRuntimeProvider");
  return context;
};
