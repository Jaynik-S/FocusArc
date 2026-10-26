import { WeekScheduleDay, WeekScheduleResponse } from "../api/types";
import { getStudyTimezone } from "../utils/studyDate";
import { useApiResource } from "./useApiResource";

const EMPTY_DAYS: WeekScheduleDay[] = [];

export const useScheduleWeek = (weekStart: string) => {
  const params = new URLSearchParams({ week_start: weekStart, client_tz: getStudyTimezone() });
  const resource = useApiResource<WeekScheduleResponse>(`/schedule/week?${params}`);
  return { days: resource.data?.days ?? EMPTY_DAYS, loading: resource.loading, error: resource.error, reload: resource.reload };
};
