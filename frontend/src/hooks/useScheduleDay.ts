import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "../api/apiClient";
import { DayScheduleResponse, Session } from "../api/types";

export const useScheduleDay = (dayDate: string) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<DayScheduleResponse>(
        `/schedule/day?day_date=${dayDate}`
      );
      setSessions(response.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, [dayDate]);

  useEffect(() => {
    load();
  }, [load]);

  return useMemo(
    () => ({ sessions, loading, error, reload: load }),
    [sessions, loading, error, load]
  );
};
