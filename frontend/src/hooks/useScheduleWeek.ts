import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "../api/apiClient";
import { WeekScheduleDay, WeekScheduleResponse } from "../api/types";

export const useScheduleWeek = (weekStart: string) => {
  const [days, setDays] = useState<WeekScheduleDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<WeekScheduleResponse>(
        `/schedule/week?week_start=${weekStart}`
      );
      setDays(response.days);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load week");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  return useMemo(
    () => ({ days, loading, error, reload: load }),
    [days, loading, error, load]
  );
};
