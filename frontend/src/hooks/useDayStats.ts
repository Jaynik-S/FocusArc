import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "../api/apiClient";
import { DayStatsResponse, TimerTotal } from "../api/types";

export const useDayStats = (dayDate: string) => {
  const [totals, setTotals] = useState<TimerTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<DayStatsResponse>(
        `/stats/day?day_date=${dayDate}`
      );
      setTotals(response.totals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load totals");
    } finally {
      setLoading(false);
    }
  }, [dayDate]);

  useEffect(() => {
    load();
  }, [load]);

  return useMemo(
    () => ({ totals, loading, error, reload: load }),
    [totals, loading, error, load]
  );
};
