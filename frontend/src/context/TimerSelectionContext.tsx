import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import { storageForAccount } from "../storage/accountStorage";
import * as TimerRuntime from "./TimerRuntimeContext";

type TimerSelectionContextValue = {
  selectedTimerId: string | null;
  setSelectedTimerId: (timerId: string | null) => void;
};

const readStoredSelectedTimer = (username: string) => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return storageForAccount(username).getItem("selectedTimerId");
  } catch {
    return null;
  }
};

const TimerSelectionContext = createContext<TimerSelectionContextValue | undefined>(
  undefined
);

export const TimerSelectionProvider = ({
  children,
  username,
}: {
  children: React.ReactNode;
  username: string;
}) => {
  const runtime = "useOptionalTimerRuntime" in TimerRuntime ? TimerRuntime.useOptionalTimerRuntime() : undefined;
  const activeTimerId = runtime?.activeSession?.timer_id ?? null;
  const previousActiveTimerId = useRef<string | null>(null);
  const [selectedTimerId, setSelectedTimerId] = useState<string | null>(() => {
    const stored = readStoredSelectedTimer(username);
    return stored || null;
  });

  useEffect(() => {
    if (activeTimerId && activeTimerId !== previousActiveTimerId.current) {
      setSelectedTimerId(activeTimerId);
    }
    previousActiveTimerId.current = activeTimerId;
  }, [activeTimerId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      if (selectedTimerId) {
        storageForAccount(username).setItem("selectedTimerId", selectedTimerId);
      } else {
        storageForAccount(username).removeItem("selectedTimerId");
      }
    } catch {
      // Ignore storage errors.
    }
  }, [selectedTimerId, username]);

  const value = useMemo(
    () => ({ selectedTimerId, setSelectedTimerId }),
    [selectedTimerId]
  );

  return (
    <TimerSelectionContext.Provider value={value}>
      {children}
    </TimerSelectionContext.Provider>
  );
};

export const useSelectedTimer = () => {
  const context = useContext(TimerSelectionContext);
  if (!context) {
    throw new Error("useSelectedTimer must be used within TimerSelectionProvider");
  }
  return context;
};
