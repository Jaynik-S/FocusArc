import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "../api/apiClient";
import { WeekStatsResponse } from "../api/types";

export const useStatsWeek = (weekStart: string) => {
  const [data, setData] = useState<WeekStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<WeekStatsResponse>(
        `/stats/week?week_start=${weekStart}`
      );
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load week stats");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  return useMemo(
    () => ({ data, loading, error, reload: load }),
    [data, loading, error, load]
  );
};
