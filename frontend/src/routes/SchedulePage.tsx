import { useMemo, useState } from "react";
import * as TimerRuntime from "../context/TimerRuntimeContext";

import DayTimeline from "../components/DayTimeline";
import { useScheduleDay } from "../hooks/useScheduleDay";
import { useReportingTimers } from "../hooks/useReportingTimers";
import {
  formatDateShort,
  formatWeekday,
  getLocalDateString,
  shiftCivilDate,
} from "../utils/date";

const SchedulePage = () => {
  const runtime = "useOptionalTimerRuntime" in TimerRuntime ? TimerRuntime.useOptionalTimerRuntime() : undefined;
  const clientTz = runtime?.timeZone ?? "America/Toronto";
  const today = runtime?.today ?? getLocalDateString(new Date(runtime?.nowMs ?? Date.now()), clientTz);
  const [selectedDate, setDayDate] = useState<string | null>(null);
  const dayDate = selectedDate ?? today;
  const timersState = useReportingTimers();
  const daySchedule = useScheduleDay(dayDate);

  const dateObj = useMemo(() => new Date(`${dayDate}T00:00:00Z`), [dayDate]);
  const dateLabel = `${formatWeekday(dateObj, "UTC")} ${formatDateShort(
    dateObj,
    "UTC"
  )}`;

  const shiftDay = (offset: number) => {
    setDayDate(shiftCivilDate(dayDate, offset));
  };

  return (
    <div className="page minimal-page">
      <div className="page-header">
        <div>
          <h1>Schedule</h1>
          <p className="muted">Select a session to adjust its duration.</p>
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
          key={dayDate}
          dayDate={dayDate}
          sessions={daySchedule.sessions}
          timers={timersState.timers}
          timeZone={clientTz}
          nowMs={runtime?.nowMs}
          commandsDisabled={runtime?.synced === false || Boolean(runtime?.busy)}
        />
      </div>
    </div>
  );
};

export default SchedulePage;
