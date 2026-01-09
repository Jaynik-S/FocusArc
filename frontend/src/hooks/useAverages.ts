import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "../api/apiClient";
import { AveragesResponse } from "../api/types";

export const useAverages = (days: number) => {
  const [data, setData] = useState<AveragesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<AveragesResponse>(
        `/stats/averages?days=${days}`
      );
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load averages");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  return useMemo(
    () => ({ data, loading, error, reload: load }),
    [data, loading, error, load]
  );
};
