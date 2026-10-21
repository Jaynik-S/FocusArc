import { Timer } from "../api/types";
import { useApiResource } from "./useApiResource";

const EMPTY_TIMERS: Timer[] = [];

/** Reporting metadata never replaces the active-only timer cache. */
export const useReportingTimers = () => {
  const resource = useApiResource<{ timers: Timer[] }>("/timers?include_archived=true");
  return { ...resource, timers: resource.data?.timers ?? EMPTY_TIMERS };
};
