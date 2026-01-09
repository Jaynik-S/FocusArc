import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "../api/apiClient";
import { Timer } from "../api/types";

const sortTimers = (timers: Timer[]) =>
  [...timers].sort((a, b) => a.created_at.localeCompare(b.created_at));

export type TimerFormValues = {
  name: string;
  color: string;
  icon: string;
};

export const useTimers = () => {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTimers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<{ timers: Timer[] }>(
        "/timers?include_archived=false"
      );
      setTimers(sortTimers(response.timers));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load timers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTimers();
  }, [loadTimers]);

  const createTimer = useCallback(async (payload: TimerFormValues) => {
    const timer = await apiFetch<Timer>("/timers", {
      method: "POST",
      body: payload,
    });
    setTimers((prev) => sortTimers([...prev, timer]));
    return timer;
  }, []);

  const updateTimer = useCallback(
    async (id: string, payload: Partial<TimerFormValues>) => {
      const timer = await apiFetch<Timer>(`/timers/${id}`, {
        method: "PATCH",
        body: payload,
      });
      setTimers((prev) =>
        sortTimers(prev.map((item) => (item.id === id ? timer : item)))
      );
      return timer;
    },
    []
  );

  const archiveTimer = useCallback(async (id: string) => {
    await apiFetch<void>(`/timers/${id}`, { method: "DELETE" });
    setTimers((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return useMemo(
    () => ({
      timers,
      loading,
      error,
      reload: loadTimers,
      createTimer,
      updateTimer,
      archiveTimer,
    }),
    [timers, loading, error, loadTimers, createTimer, updateTimer, archiveTimer]
  );
};
