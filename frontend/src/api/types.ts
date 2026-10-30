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

export type StudyStateResponse = {
  username: string;
  changed: boolean;
  revision: number;
  server_now: string;
  study_timezone: string;
  day_date: string;
  day_start_at: string;
  day_end_at: string;
  lease_expires_at: string | null;
  active_session?: Session | null;
  timers?: Array<Timer & { completed_today_seconds: number }>;
};

export type StudySnapshot = StudyStateResponse & {
  active_session: Session | null;
  timers: Array<Timer & { completed_today_seconds: number }>;
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

export type StartTimerResponse = {
  stopped_session: Session | null;
  active_session: Session;
};

export type StopTimerResponse = {
  stopped_session: Session | null;
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

export type AnalyticsDay = {
  day_date: string;
  recorded_seconds: number;
  timed_seconds: number;
  session_count: number;
};

export type AnalyticsWeek = {
  week_start: string;
  recorded_seconds: number;
  active_days: number;
  is_partial: boolean;
};

export type AnalyticsResponse = {
  range: { from: string; to: string; client_tz: string };
  summary: {
    recorded_seconds: number;
    timed_seconds: number;
    session_count: number;
    active_days: number;
    day_count: number;
    consistency_percent: number;
    average_seconds_per_day: number;
  };
  daily: AnalyticsDay[];
  weekly: AnalyticsWeek[];
  hourly: { hour: number; timed_seconds: number }[];
  comparison: {
    previous_week_start: string;
    current_week_start: string;
    previous_seconds: number;
    current_seconds: number;
    delta_seconds: number;
    delta_percent: number | null;
  } | null;
};

export type ActivitySession = Session & {
  range_recorded_seconds: number;
  range_timed_seconds: number;
};
