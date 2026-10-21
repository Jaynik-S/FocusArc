import { ActivitySession, Session } from "../api/types";
import { useApiResource } from "./useApiResource";

export type HistorySession = Session & Partial<Pick<ActivitySession, "range_recorded_seconds" | "range_timed_seconds">>;

type UseSessionsResult = {
  sessions: HistorySession[];
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export const useSessions = (
  fromDate: string,
  toDate: string,
  timerId: string | null,
  options: { dateBasis?: "activity" | "saved"; clientTz?: string; enabled?: boolean } = {}
): UseSessionsResult => {
  const params = new URLSearchParams({ from: fromDate, to: toDate });
  if (timerId) params.set("timer_id", timerId);
  if (options.dateBasis === "activity") params.set("client_tz", options.clientTz ?? "UTC");
  const endpoint = options.dateBasis === "activity" ? "/stats/analytics/sessions" : "/sessions";
  const resource = useApiResource<{ sessions: HistorySession[] }>(options.enabled === false ? null : `${endpoint}?${params}`);
  return { sessions: resource.data?.sessions ?? EMPTY_SESSIONS, loading: resource.loading, error: resource.error, reload: resource.reload };
};

const EMPTY_SESSIONS: HistorySession[] = [];
