import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

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
  adjustOffset: (timerId: string, deltaSeconds: number) => void;
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
  const { activeSession, elapsedSeconds, loading, busy, error, refresh, startTimer, stopTimer } =
    useActiveSession(username);
  const [elapsedByTimer, setElapsedByTimer] = useState<Record<string, number>>(
    () => readStoredElapsed(username)
  );
  const [offsets, setOffsets] = useState<Record<string, number>>(() => readStoredOffsets(username));
  const [sessionAdjustments, setSessionAdjustments] = useState<Record<string, number>>(
    () => readStoredSessionAdjustments(username)
  );
  const sessionAdjustmentSeconds = activeSession ? sessionAdjustments[activeSession.id] ?? 0 : 0;

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
    (timerId: string, deltaSeconds: number) => {
      setOffsets((prev) => {
        const current = prev[timerId] ?? 0;
        const baseSeconds = elapsedByTimer[timerId] ?? 0;
        let next = current + deltaSeconds;
        if (activeSession?.timer_id === timerId) {
          const minOffset = -(baseSeconds + elapsedSeconds);
          if (next < minOffset) {
            next = minOffset;
          }
        }
        const appliedDelta = next - current;
        if (appliedDelta !== 0 && activeSession?.timer_id === timerId) {
          setSessionAdjustments((values) => ({
            ...values,
            [activeSession.id]: (values[activeSession.id] ?? 0) + appliedDelta,
          }));
        }
        return {
          ...prev,
          [timerId]: next,
        };
      });
    },
    [activeSession?.id, activeSession?.timer_id, elapsedSeconds, elapsedByTimer]
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

  const applyElapsedToTimer = useCallback((timerId: string, deltaSeconds: number) => {
    if (!timerId || deltaSeconds <= 0) {
      return;
    }
    setElapsedByTimer((prev) => ({
      ...prev,
      [timerId]: (prev[timerId] ?? 0) + deltaSeconds,
    }));
  }, []);

  const startTimerWithAdjustments = useCallback(
    async (timerId: string) => {
      const previousTimerId =
        activeSession && activeSession.timer_id !== timerId
          ? activeSession.timer_id
          : null;
      const elapsedSnapshot = elapsedSeconds;
      const adjustmentSeconds =
        activeSession && activeSession.timer_id !== timerId
          ? sessionAdjustmentSeconds
          : 0;
      await startTimer(timerId, adjustmentSeconds);
      if (previousTimerId) {
        applyElapsedToTimer(previousTimerId, elapsedSnapshot);
      }
    },
    [activeSession, applyElapsedToTimer, elapsedSeconds, sessionAdjustmentSeconds, startTimer]
  );

  const stopTimerWithAdjustments = useCallback(async () => {
    const previousTimerId = activeSession?.timer_id ?? null;
    const elapsedSnapshot = elapsedSeconds;
    await stopTimer(sessionAdjustmentSeconds);
    if (previousTimerId) {
      applyElapsedToTimer(previousTimerId, elapsedSnapshot);
    }
  }, [activeSession, applyElapsedToTimer, elapsedSeconds, sessionAdjustmentSeconds, stopTimer]);

  const value = useMemo(
    () => ({
      activeSession,
      elapsedSeconds,
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
