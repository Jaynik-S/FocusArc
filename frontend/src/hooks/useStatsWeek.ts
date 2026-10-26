import { WeekStatsResponse } from "../api/types";
import { useApiResource } from "./useApiResource";
import { getClientTimezone } from "../utils/date";

export const useStatsWeek = (weekStart: string) =>
  useApiResource<WeekStatsResponse>(`/stats/week?${new URLSearchParams({ week_start: weekStart, client_tz: getClientTimezone() })}`);
