import { createContext, useContext, useEffect, useMemo, useState } from "react";

type TimerSelectionContextValue = {
  selectedTimerId: string | null;
  setSelectedTimerId: (timerId: string | null) => void;
};

const SELECTED_TIMER_STORAGE_KEY = "coursetimers.selectedTimerId";

const readStoredSelectedTimer = () => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return localStorage.getItem(SELECTED_TIMER_STORAGE_KEY);
  } catch {
    return null;
  }
};

const TimerSelectionContext = createContext<TimerSelectionContextValue | undefined>(
  undefined
);

export const TimerSelectionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [selectedTimerId, setSelectedTimerId] = useState<string | null>(() => {
    const stored = readStoredSelectedTimer();
    return stored || null;
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      if (selectedTimerId) {
        localStorage.setItem(SELECTED_TIMER_STORAGE_KEY, selectedTimerId);
      } else {
        localStorage.removeItem(SELECTED_TIMER_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors.
    }
  }, [selectedTimerId]);

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
