import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { getUsername } from "../api/apiClient";
import { useActiveSession } from "../hooks/useActiveSession";

type TimerRuntimeContextValue = {
  activeSession: ReturnType<typeof useActiveSession>["activeSession"];
  elapsedSeconds: number;
  loading: boolean;
  busy: boolean;
  refresh: ReturnType<typeof useActiveSession>["refresh"];
  startTimer: (timerId: string) => Promise<void>;
  stopTimer: () => Promise<void>;
  offsets: Record<string, number>;
  activeAdjustmentSeconds: number;
  adjustOffset: (timerId: string, deltaSeconds: number) => void;
};

const OFFSETS_STORAGE_KEY = "coursetimers.timerOffsets";
const SESSION_ADJUSTMENTS_STORAGE_KEY = "coursetimers.sessionAdjustments";

const readStoredOffsets = () => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = localStorage.getItem(OFFSETS_STORAGE_KEY);
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

const readStoredSessionAdjustments = () => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = localStorage.getItem(SESSION_ADJUSTMENTS_STORAGE_KEY);
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
}: {
  children: React.ReactNode;
}) => {
  const hasUsername = Boolean(getUsername());
  const { activeSession, elapsedSeconds, loading, busy, refresh, startTimer, stopTimer } =
    useActiveSession(hasUsername);
  const [offsets, setOffsets] = useState<Record<string, number>>(() => readStoredOffsets());
  const [sessionAdjustmentSeconds, setSessionAdjustmentSeconds] = useState(0);

  useEffect(() => {
    if (!activeSession) {
      setSessionAdjustmentSeconds(0);
      return;
    }
    const stored = readStoredSessionAdjustments();
    setSessionAdjustmentSeconds(stored[activeSession.id] ?? 0);
  }, [activeSession?.id]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      localStorage.setItem(OFFSETS_STORAGE_KEY, JSON.stringify(offsets));
    } catch {
      // Ignore storage errors.
    }
  }, [offsets]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!activeSession) {
      return;
    }
    try {
      const stored = readStoredSessionAdjustments();
      stored[activeSession.id] = sessionAdjustmentSeconds;
      localStorage.setItem(
        SESSION_ADJUSTMENTS_STORAGE_KEY,
        JSON.stringify(stored)
      );
    } catch {
      // Ignore storage errors.
    }
  }, [activeSession, sessionAdjustmentSeconds]);

  const adjustOffset = useCallback(
    (timerId: string, deltaSeconds: number) => {
      setOffsets((prev) => {
        const current = prev[timerId] ?? 0;
        let next = current + deltaSeconds;
        if (activeSession?.timer_id === timerId) {
          const minOffset = -elapsedSeconds;
          if (next < minOffset) {
            next = minOffset;
          }
        }
        const appliedDelta = next - current;
        if (appliedDelta !== 0 && activeSession?.timer_id === timerId) {
          setSessionAdjustmentSeconds((value) => value + appliedDelta);
        }
        return {
          ...prev,
          [timerId]: next,
        };
      });
    },
    [activeSession?.timer_id, elapsedSeconds]
  );

  const activeAdjustmentSeconds = sessionAdjustmentSeconds;

  const startTimerWithAdjustments = useCallback(
    async (timerId: string) => {
      const adjustmentSeconds =
        activeSession && activeSession.timer_id !== timerId
          ? sessionAdjustmentSeconds
          : 0;
      await startTimer(timerId, adjustmentSeconds);
    },
    [activeSession, sessionAdjustmentSeconds, startTimer]
  );

  const stopTimerWithAdjustments = useCallback(async () => {
    await stopTimer(sessionAdjustmentSeconds);
  }, [sessionAdjustmentSeconds, stopTimer]);

  const value = useMemo(
    () => ({
      activeSession,
      elapsedSeconds,
      loading,
      busy,
      refresh,
      startTimer: startTimerWithAdjustments,
      stopTimer: stopTimerWithAdjustments,
      offsets,
      activeAdjustmentSeconds,
      adjustOffset,
    }),
    [
      activeSession,
      elapsedSeconds,
      loading,
      busy,
      refresh,
      startTimerWithAdjustments,
      stopTimerWithAdjustments,
      offsets,
      activeAdjustmentSeconds,
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
