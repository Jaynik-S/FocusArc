import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { apiFetch } from "../api/apiClient";
import { adjustStudySession } from "../api/sessionAdjustments";
import { STUDY_DATA_CHANGED_EVENT } from "../api/dataEvents";
import type { Session, Timer } from "../api/types";
import { useActiveSession } from "../hooks/useActiveSession";
import { storageForAccount } from "../storage/accountStorage";

type TimerRuntimeContextValue = {
  activeSession: ReturnType<typeof useActiveSession>["activeSession"];
  elapsedSeconds: number;
  loading: boolean;
  busy: boolean;
  error: string | null;
  refresh: ReturnType<typeof useActiveSession>["refresh"];
  startTimer: (timerId: string) => Promise<void>;
  stopTimer: () => Promise<void>;
  elapsedByTimer: Record<string, number>;
  offsets: Record<string, number>;
  activeAdjustmentSeconds: number;
  resetRuntimeState: () => void;
  adjustOffset: (timerId: string, deltaSeconds: number) => Promise<void>;
};

const readStoredElapsed = (username: string) => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = storageForAccount(username).getItem("timerElapsed");
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, number>;
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, Number(value) || 0])
    );
  } catch {
    return {};
  }
};

const readStoredOffsets = (username: string) => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = storageForAccount(username).getItem("timerOffsets");
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, number>;
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, Number(value) || 0])
    );
  } catch {
    return {};
  }
};

const readStoredSessionAdjustments = (username: string) => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = storageForAccount(username).getItem("sessionAdjustments");
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, number>;
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, Number(value) || 0])
    );
  } catch {
    return {};
  }
};

const TimerRuntimeContext = createContext<TimerRuntimeContextValue | undefined>(
  undefined
);

export const TimerRuntimeProvider = ({
  children,
  username,
}: {
  children: React.ReactNode;
  username: string;
}) => {
  const { activeSession, elapsedSeconds, loading, busy: sessionBusy, error, refresh, startTimer, stopTimer } =
    useActiveSession(username);
  const [adjusting, setAdjusting] = useState(false);
  const adjustingRef = useRef(false);
  const totalsRevision = useRef(0);
  const busy = sessionBusy || adjusting;
  const [elapsedByTimer, setElapsedByTimer] = useState<Record<string, number>>(
    () => readStoredElapsed(username)
  );
  const [offsets, setOffsets] = useState<Record<string, number>>(() => readStoredOffsets(username));
  const [sessionAdjustments, setSessionAdjustments] = useState<Record<string, number>>(
    () => readStoredSessionAdjustments(username)
  );
  const sessionAdjustmentSeconds = activeSession ? sessionAdjustments[activeSession.id] ?? 0 : 0;

  const refreshTotals = useCallback(async () => {
    const revision = ++totalsRevision.current;
    const response = await apiFetch<{ timers: Timer[] }>("/timers?include_archived=false");
    if (revision !== totalsRevision.current) return;
    setElapsedByTimer(Object.fromEntries(response.timers.map((timer) => [timer.id, timer.cycle_total_seconds])));
    setOffsets({});
  }, []);

  useEffect(() => {
    const reload = (event?: Event) => {
      const session = (event as CustomEvent<Session> | undefined)?.detail;
      if (session?.end_at) setSessionAdjustments((values) => ({ ...values, [session.id]: 0 }));
      void refreshTotals().catch(() => { /* Retain offline counters. */ });
    };
    reload();
    window.addEventListener(STUDY_DATA_CHANGED_EVENT, reload);
    return () => { totalsRevision.current++; window.removeEventListener(STUDY_DATA_CHANGED_EVENT, reload); };
  }, [refreshTotals]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      storageForAccount(username).setItem("timerElapsed", JSON.stringify(elapsedByTimer));
    } catch {
      // Ignore storage errors.
    }
  }, [elapsedByTimer, username]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      storageForAccount(username).setItem("timerOffsets", JSON.stringify(offsets));
    } catch {
      // Ignore storage errors.
    }
  }, [offsets, username]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      storageForAccount(username).setItem(
        "sessionAdjustments", JSON.stringify(sessionAdjustments)
      );
    } catch {
      // Ignore storage errors.
    }
  }, [sessionAdjustments, username]);

  const adjustOffset = useCallback(
    async (timerId: string, deltaSeconds: number) => {
      if (adjustingRef.current || sessionBusy) return;
      adjustingRef.current = true;
      setAdjusting(true);
      try {
        const session = activeSession?.timer_id === timerId ? activeSession :
          await apiFetch<Session | null>(`/timers/${timerId}/latest-session`);
        if (!session) throw new Error("Start this timer before adjusting its duration.");
        // Legacy browser offsets are sent once on stop; new edits persist immediately.
        await adjustStudySession(session, deltaSeconds);
      } finally {
        adjustingRef.current = false;
        setAdjusting(false);
      }
    },
    [activeSession, sessionBusy]
  );

  const activeAdjustmentSeconds = sessionAdjustmentSeconds;
  const resetRuntimeState = useCallback(() => {
    setElapsedByTimer({});
    setOffsets({});
    setSessionAdjustments({});
    if (typeof window === "undefined") {
      return;
    }
    try {
      const storage = storageForAccount(username);
      storage.removeItem("timerElapsed");
      storage.removeItem("timerOffsets");
      storage.removeItem("sessionAdjustments");
    } catch {
      // Ignore storage errors.
    }
  }, [username]);

  const startTimerWithAdjustments = useCallback(
    async (timerId: string) => {
      if (adjustingRef.current) return;
      const adjustmentSeconds =
        activeSession && activeSession.timer_id !== timerId
          ? sessionAdjustmentSeconds
          : 0;
      await startTimer(timerId, adjustmentSeconds);
      if (activeSession && activeSession.timer_id !== timerId) {
        setSessionAdjustments((values) => ({ ...values, [activeSession.id]: 0 }));
      }
    },
    [activeSession, sessionAdjustmentSeconds, startTimer]
  );

  const stopTimerWithAdjustments = useCallback(async () => {
    if (adjustingRef.current) return;
    await stopTimer(sessionAdjustmentSeconds);
  }, [sessionAdjustmentSeconds, stopTimer]);

  const value = useMemo(
    () => ({
      activeSession,
      elapsedSeconds: Math.max(0, elapsedSeconds + sessionAdjustmentSeconds),
      loading,
      busy,
      error,
      refresh,
      startTimer: startTimerWithAdjustments,
      stopTimer: stopTimerWithAdjustments,
      elapsedByTimer,
      offsets,
      activeAdjustmentSeconds,
      resetRuntimeState,
      adjustOffset,
    }),
    [
      activeSession,
      elapsedSeconds,
      sessionAdjustmentSeconds,
      loading,
      busy,
      error,
      refresh,
      startTimerWithAdjustments,
      stopTimerWithAdjustments,
      elapsedByTimer,
      offsets,
      activeAdjustmentSeconds,
      resetRuntimeState,
      adjustOffset,
    ]
  );

  return (
    <TimerRuntimeContext.Provider value={value}>
      {children}
    </TimerRuntimeContext.Provider>
  );
};

export const useTimerRuntime = () => {
  const context = useContext(TimerRuntimeContext);
  if (!context) {
    throw new Error("useTimerRuntime must be used within TimerRuntimeProvider");
  }
  return context;
};
