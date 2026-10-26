import { Timer } from "../api/types";
import { useApiResource } from "./useApiResource";
import { getStudySnapshot } from "../api/studySyncState";
import { useAuth } from "../contexts/AuthContext";

const EMPTY_TIMERS: Timer[] = [];

/** Reporting metadata never replaces the active-only timer cache. */
export const useReportingTimers = () => {
  const { user } = useAuth();
  const snapshot = getStudySnapshot(user?.username ?? "");
  const resource = useApiResource<{ timers: Timer[] }>(snapshot ? null : "/timers?include_archived=true");
  return { ...resource, timers: snapshot?.timers ?? resource.data?.timers ?? EMPTY_TIMERS };
};
