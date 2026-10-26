import { DayScheduleResponse, Session } from "../api/types";
import { getStudyTimezone } from "../utils/studyDate";
import { useApiResource } from "./useApiResource";

const EMPTY_SESSIONS: Session[] = [];

export const useScheduleDay = (dayDate: string) => {
  const params = new URLSearchParams({ day_date: dayDate, client_tz: getStudyTimezone() });
  const resource = useApiResource<DayScheduleResponse>(`/schedule/day?${params}`);
  return { sessions: resource.data?.sessions ?? EMPTY_SESSIONS, loading: resource.loading, error: resource.error, reload: resource.reload };
};
