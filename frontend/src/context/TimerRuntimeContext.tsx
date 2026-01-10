import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { getUsername } from "../api/apiClient";
import { useActiveSession } from "../hooks/useActiveSession";

type TimerRuntimeContextValue = {
  activeSession: ReturnType<typeof useActiveSession>["activeSession"];
  elapsedSeconds: number;
  loading: boolean;
  busy: boolean;
  refresh: ReturnType<typeof useActiveSession>["refresh"];
  startTimer: ReturnType<typeof useActiveSession>["startTimer"];
  stopTimer: ReturnType<typeof useActiveSession>["stopTimer"];
  offsets: Record<string, number>;
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

  const adjustOffset = useCallback((timerId: string, deltaSeconds: number) => {
    setOffsets((prev) => ({
      ...prev,
      [timerId]: (prev[timerId] ?? 0) + deltaSeconds,
    }));
  }, []);

  const value = useMemo(
    () => ({
      activeSession,
      elapsedSeconds,
      loading,
      busy,
      refresh,
      startTimer,
      stopTimer,
      offsets,
      adjustOffset,
    }),
    [
      activeSession,
      elapsedSeconds,
      loading,
      busy,
      refresh,
      startTimer,
      stopTimer,
      offsets,
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
