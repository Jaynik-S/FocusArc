export type Timer = {
  id: string;
  name: string;
  color: string;
  icon: string;
  cycle_total_seconds: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type Session = {
  id: string;
  timer_id: string;
  start_at: string;
  end_at: string | null;
  duration_seconds: number | null;
  client_tz: string;
  day_date: string;
  day_of_week: number;
};

export type TimerTotal = {
  timer_id: string;
  total_seconds: number;
};

export type ResetTotalsResponse = {
  totals: TimerTotal[];
};

export type DayStatsResponse = {
  day_date: string;
  totals: TimerTotal[];
};

export type EndDayResponse = {
  ended_day_date: string;
  finalized: boolean;
  totals: TimerTotal[];
};

export type DayScheduleResponse = {
  day_date: string;
  sessions: Session[];
};

export type WeekScheduleDay = {
  day_date: string;
  sessions: Session[];
};

export type WeekScheduleResponse = {
  week_start: string;
  days: WeekScheduleDay[];
};

export type WeekStatsDay = {
  day_date: string;
  totals: TimerTotal[];
};

export type WeekStatsResponse = {
  week_start: string;
  daily: WeekStatsDay[];
};

export type AverageEntry = {
  timer_id: string;
  avg_seconds_per_day: number;
};

export type AveragesResponse = {
  days: number;
  averages: AverageEntry[];
};
