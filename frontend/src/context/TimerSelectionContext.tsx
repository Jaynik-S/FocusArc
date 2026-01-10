import { createContext, useContext, useMemo, useState } from "react";

type TimerSelectionContextValue = {
  selectedTimerId: string | null;
  setSelectedTimerId: (timerId: string | null) => void;
};

const TimerSelectionContext = createContext<TimerSelectionContextValue | undefined>(
  undefined
);

export const TimerSelectionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [selectedTimerId, setSelectedTimerId] = useState<string | null>(null);

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
