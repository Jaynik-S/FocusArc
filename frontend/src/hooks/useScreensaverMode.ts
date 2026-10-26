import { useState } from "react";

/** Mounted after the first shared snapshot. View choice is deliberately never persisted. */
export const useScreensaverMode = (activeSessionId: string | null) => {
  const [dismissedSessionId, setDismissedSessionId] = useState(activeSessionId);
  return {
    isOpen: activeSessionId !== null && activeSessionId !== dismissedSessionId,
    exit: () => setDismissedSessionId(activeSessionId),
  };
};
