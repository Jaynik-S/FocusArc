import { DayStatsResponse, TimerTotal } from "../api/types";
import { useApiResource } from "./useApiResource";
import { getClientTimezone } from "../utils/date";

const EMPTY_TOTALS: TimerTotal[] = [];

export const useDayStats = (dayDate: string, enabled = true) => {
  const params = new URLSearchParams({ day_date: dayDate, client_tz: getClientTimezone() });
  const resource = useApiResource<DayStatsResponse>(enabled ? `/stats/day?${params}` : null);
  return { totals: resource.data?.totals ?? EMPTY_TOTALS, loading: resource.loading, error: resource.error, reload: resource.reload };
};
