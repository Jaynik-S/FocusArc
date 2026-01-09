import { useEffect, useMemo, useState } from "react";

import { Session, Timer, WeekScheduleDay } from "../api/types";
import { formatTime, formatWeekday, getClientTimezone } from "../utils/date";

const formatRange = (session: Session, timeZone: string) => {
  const start = new Date(session.start_at);
  const end = session.end_at ? new Date(session.end_at) : new Date();
  return `${formatTime(start, timeZone)} - ${formatTime(end, timeZone)}`;
};

type WeekAccordionProps = {
  days: WeekScheduleDay[];
  timers: Timer[];
  timeZone?: string;
};

const WeekAccordion = ({ days, timers, timeZone }: WeekAccordionProps) => {
  const zone = timeZone ?? getClientTimezone();
  const timerMap = useMemo(() => {
    return new Map(timers.map((timer) => [timer.id, timer]));
  }, [timers]);
  const sortedDays = useMemo(
    () => [...days].sort((a, b) => a.day_date.localeCompare(b.day_date)),
    [days]
  );
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    setOpenDays(new Set(sortedDays.slice(0, 2).map((day) => day.day_date)));
  }, [sortedDays]);

  const toggleDay = (dayDate: string) => {
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayDate)) {
        next.delete(dayDate);
      } else {
        next.add(dayDate);
      }
      return next;
    });
  };

  return (
    <div className="week-accordion">
      {sortedDays.map((day, index) => {
        const dateObj = new Date(`${day.day_date}T00:00:00`);
        const title = `${formatWeekday(dateObj, zone)} ${day.day_date}`;
        const isOpen = openDays.has(day.day_date);

        return (
          <div
            className="week-day"
            key={day.day_date}
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <button
              className="week-day-header"
              type="button"
              onClick={() => toggleDay(day.day_date)}
            >
              <span>{title}</span>
              <span className="week-day-count">
                {day.sessions.length} sessions
              </span>
            </button>
            {isOpen ? (
              <div className="week-day-body">
                {day.sessions.length === 0 ? (
                  <div className="timeline-empty">No sessions</div>
                ) : (
                  day.sessions.map((session) => {
                    const timer = timerMap.get(session.timer_id);
                    return (
                      <div className="week-session" key={session.id}>
                        <div
                          className="dot"
                          style={{ background: timer?.color ?? "#1d4ed8" }}
                        />
                        <div>
                          <div className="week-session-title">
                            {timer?.name ?? "Timer"}
                          </div>
                          <div className="week-session-meta">
                            {formatRange(session, zone)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

export default WeekAccordion;
