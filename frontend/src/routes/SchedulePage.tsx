import { useEffect, useMemo, useState } from "react";

import { getUsername } from "../api/apiClient";
import DayTimeline from "../components/DayTimeline";
import PrimaryNav from "../components/PrimaryNav";
import TopBar from "../components/TopBar";
import WeekAccordion from "../components/WeekAccordion";
import { useScheduleDay } from "../hooks/useScheduleDay";
import { useScheduleWeek } from "../hooks/useScheduleWeek";
import { useTimers } from "../hooks/useTimers";
import {
  getClientTimezone,
  getLocalDateString,
  getWeekStartDateString,
} from "../utils/date";

const SchedulePage = () => {
  const username = useMemo(() => getUsername(), []);
  const clientTz = useMemo(() => getClientTimezone(), []);
  const [view, setView] = useState<"day" | "week">("day");
  const [dayDate, setDayDate] = useState(() =>
    getLocalDateString(new Date(), clientTz)
  );
  const [weekStart, setWeekStart] = useState(() =>
    getWeekStartDateString(new Date(), clientTz)
  );

  const timersState = useTimers();
  const daySchedule = useScheduleDay(dayDate);
  const weekSchedule = useScheduleWeek(weekStart);

  useEffect(() => {
    setWeekStart(getWeekStartDateString(new Date(`${dayDate}T00:00:00`), clientTz));
  }, [dayDate, clientTz]);

  return (
    <div className="page">
      <TopBar username={username} />
      <PrimaryNav />
      <div className="card schedule-header">
        <div>
          <h2>Schedule</h2>
          <p>See your study blocks by day or week.</p>
        </div>
        <div className="schedule-toggle">
          <button
            className={view === "day" ? "primary" : "secondary"}
            type="button"
            onClick={() => setView("day")}
          >
            Day
          </button>
          <button
            className={view === "week" ? "primary" : "secondary"}
            type="button"
            onClick={() => setView("week")}
          >
            Week
          </button>
        </div>
      </div>
      <div className="card schedule-panel">
        <div className="schedule-controls">
          {view === "day" ? (
            <label className="field">
              <span>Day</span>
              <input
                type="date"
                value={dayDate}
                onChange={(event) => setDayDate(event.target.value)}
              />
            </label>
          ) : (
            <label className="field">
              <span>Week starting</span>
              <input
                type="date"
                value={weekStart}
                onChange={(event) => setWeekStart(event.target.value)}
              />
            </label>
          )}
          <div className="schedule-meta">Timezone: {clientTz}</div>
        </div>
        {view === "day" ? (
          <>
            {daySchedule.loading ? <div>Loading day view...</div> : null}
            {daySchedule.error ? (
              <div className="error">{daySchedule.error}</div>
            ) : null}
            <DayTimeline
              sessions={daySchedule.sessions}
              timers={timersState.timers}
              timeZone={clientTz}
            />
          </>
        ) : (
          <>
            {weekSchedule.loading ? <div>Loading week view...</div> : null}
            {weekSchedule.error ? (
              <div className="error">{weekSchedule.error}</div>
            ) : null}
            <WeekAccordion
              days={weekSchedule.days}
              timers={timersState.timers}
              timeZone={clientTz}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default SchedulePage;
