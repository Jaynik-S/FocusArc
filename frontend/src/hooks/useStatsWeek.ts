import { WeekStatsResponse } from "../api/types";
import { useApiResource } from "./useApiResource";

export const useStatsWeek = (weekStart: string) =>
  useApiResource<WeekStatsResponse>(`/stats/week?week_start=${weekStart}`);
