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
  const [offsets, setOffsets] = useState<Record<string, number>>({});
  const [sessionAdjustmentSeconds, setSessionAdjustmentSeconds] = useState(0);

  useEffect(() => {
    setSessionAdjustmentSeconds(0);
  }, [activeSession?.id]);

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
