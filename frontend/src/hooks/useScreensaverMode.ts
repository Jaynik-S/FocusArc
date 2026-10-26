import { useCallback, useState } from "react";

/** Mounted after the first shared snapshot. View choice is deliberately never persisted. */
export const useScreensaverMode = (activeSessionId: string | null) => {
  const [dismissedSessionId, setDismissedSessionId] = useState(activeSessionId);
  const exit = useCallback(() => setDismissedSessionId(activeSessionId), [activeSessionId]);
  return {
    isOpen: activeSessionId !== null && activeSessionId !== dismissedSessionId,
    exit,
  };
};
