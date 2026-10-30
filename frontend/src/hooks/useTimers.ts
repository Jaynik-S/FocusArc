import { useCallback, useMemo } from "react";

import { apiFetch } from "../api/apiClient";
import { notifyStudyMutationCommitted } from "../api/dataEvents";
import { Timer } from "../api/types";
import { useAuth } from "../contexts/AuthContext";
import { getStudySnapshot, requestStudySync } from "../api/studySyncState";
import { useApiResource } from "./useApiResource";

const sortTimers = (timers: Timer[]) =>
  [...timers].sort((a, b) => a.created_at.localeCompare(b.created_at));

const EMPTY_TIMERS: Timer[] = [];

export type TimerFormValues = {
  name: string;
  color: string;
};

export const useTimers = () => {
  const { user } = useAuth();
  const username = user?.username ?? "";
  const snapshot = getStudySnapshot(username);
  const resource = useApiResource<{ timers: Timer[] }>(snapshot ? null : "/timers?include_archived=false");
  const source = snapshot?.timers ?? resource.data?.timers ?? EMPTY_TIMERS;
  const timers = useMemo(() => sortTimers(source.filter((timer) => !timer.is_archived)), [source]);
  const loadTimers = useCallback(async () => {
    if (getStudySnapshot(username)) await requestStudySync();
    else resource.reload();
  }, [username, resource.reload]);

  const createTimer = useCallback(async (payload: TimerFormValues) => {
    const timer = await apiFetch<Timer>("/timers", {
      method: "POST",
      body: payload,
    });
    notifyStudyMutationCommitted();
    await requestStudySync();
    return timer;
  }, []);

  const updateTimer = useCallback(
    async (id: string, payload: Partial<TimerFormValues>) => {
      const timer = await apiFetch<Timer>(`/timers/${id}`, {
        method: "PATCH",
        body: payload,
      });
      notifyStudyMutationCommitted();
      await requestStudySync();
      return timer;
    },
    []
  );

  const archiveTimer = useCallback(async (id: string) => {
    await apiFetch<void>(`/timers/${id}`, { method: "DELETE" });
    notifyStudyMutationCommitted();
    await requestStudySync();
  }, []);

  return useMemo(
    () => ({
      timers,
      loading: snapshot ? false : resource.loading,
      error: snapshot ? null : resource.error,
      reload: loadTimers,
      createTimer,
      updateTimer,
      archiveTimer,
    }),
    [timers, snapshot, resource.loading, resource.error, loadTimers, createTimer, updateTimer, archiveTimer]
  );
};
