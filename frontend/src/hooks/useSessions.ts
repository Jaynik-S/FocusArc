import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "../api/apiClient";
import { Session } from "../api/types";

type UseSessionsResult = {
  sessions: Session[];
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export const useSessions = (
  fromDate: string,
  toDate: string,
  timerId: string | null
): UseSessionsResult => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      if (timerId) {
        params.set("timer_id", timerId);
      }
      const response = await apiFetch<{ sessions: Session[] }>(
        `/sessions?${params.toString()}`
      );
      setSessions(response.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, timerId]);

  useEffect(() => {
    load();
  }, [load]);

  return useMemo(
    () => ({ sessions, loading, error, reload: load }),
    [sessions, loading, error, load]
  );
};
