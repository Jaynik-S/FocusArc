import { DayStatsResponse, TimerTotal } from "../api/types";
import { useApiResource } from "./useApiResource";

const EMPTY_TOTALS: TimerTotal[] = [];

export const useDayStats = (dayDate: string, enabled = true) => {
  const resource = useApiResource<DayStatsResponse>(enabled ? `/stats/day?day_date=${dayDate}` : null);
  return { totals: resource.data?.totals ?? EMPTY_TOTALS, loading: resource.loading, error: resource.error, reload: resource.reload };
};
