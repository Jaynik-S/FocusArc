import { useEffect, useRef } from "react";
import { AnalyticsResponse } from "../api/types";
import { useApiResource } from "./useApiResource";

export const useAnalytics = (from: string, to: string, clientTz: string, timerId: string | null, activeSessionId: string | null, enabled = true) => {
  const params = new URLSearchParams({ from, to, client_tz: clientTz });
  if (timerId) params.set("timer_id", timerId);
  const resource = useApiResource<AnalyticsResponse>(enabled ? `/stats/analytics?${params}` : null);
  const { reload } = resource;
  const previousSession = useRef(activeSessionId);

  useEffect(() => {
    if (previousSession.current !== activeSessionId) {
      previousSession.current = activeSessionId;
      reload();
    }
  }, [activeSessionId, reload]);

  useEffect(() => {
    let lastRefresh = 0;
    const refreshVisible = () => {
      if (!document.hidden && Date.now() - lastRefresh > 100) {
        lastRefresh = Date.now();
        reload();
      }
    };
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [reload]);
  return resource;
};
