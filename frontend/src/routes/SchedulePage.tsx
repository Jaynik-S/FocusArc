import { useMemo, useState } from "react";

import DayTimeline from "../components/DayTimeline";
import { useScheduleDay } from "../hooks/useScheduleDay";
import { useTimers } from "../hooks/useTimers";
import {
  formatDateShort,
  formatWeekday,
  getClientTimezone,
  getLocalDateString,
} from "../utils/date";

const SchedulePage = () => {
  const clientTz = useMemo(() => getClientTimezone(), []);
  const [dayDate, setDayDate] = useState(() =>
    getLocalDateString(new Date(), clientTz)
  );
  const timersState = useTimers();
  const daySchedule = useScheduleDay(dayDate);

  const dateObj = useMemo(() => new Date(`${dayDate}T00:00:00`), [dayDate]);
  const dateLabel = `${formatWeekday(dateObj, clientTz)} ${formatDateShort(
    dateObj,
    clientTz
  )}`;

  const shiftDay = (offset: number) => {
    const nextDate = new Date(`${dayDate}T00:00:00`);
    nextDate.setDate(nextDate.getDate() + offset);
    setDayDate(getLocalDateString(nextDate, clientTz));
  };

  return (
    <div className="page minimal-page">
      <div className="page-header">
        <div>
          <h1>Schedule</h1>
          <p className="muted">Day view only.</p>
        </div>
        <div className="schedule-nav">
          <button className="ghost" type="button" onClick={() => shiftDay(-1)}>
            Back
          </button>
          <div className="schedule-date">{dateLabel}</div>
          <button className="ghost" type="button" onClick={() => shiftDay(1)}>
            Next
          </button>
        </div>
      </div>
      <div className="panel">
        <div className="panel-meta">Timezone: {clientTz}</div>
        {daySchedule.loading ? <div>Loading day view...</div> : null}
        {daySchedule.error ? <div className="error">{daySchedule.error}</div> : null}
        <DayTimeline
          sessions={daySchedule.sessions}
          timers={timersState.timers}
          timeZone={clientTz}
        />
      </div>
    </div>
  );
};

export default SchedulePage;
