import { WeekStatsResponse } from "../api/types";
import { useApiResource } from "./useApiResource";
import { getStudyTimezone } from "../utils/studyDate";

export const useStatsWeek = (weekStart: string) =>
  useApiResource<WeekStatsResponse>(`/stats/week?${new URLSearchParams({ week_start: weekStart, client_tz: getStudyTimezone() })}`);
