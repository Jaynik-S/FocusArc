import { useMemo } from "react";

import { Session, Timer } from "../api/types";
import {
  formatTime,
  getClientTimezone,
  getMinutesSinceMidnight,
} from "../utils/date";
import SessionBlock from "./SessionBlock";

const PX_PER_MINUTE = 1.2;
const MIN_BLOCK_HEIGHT = 12;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const formatRange = (start: Date, end: Date, timeZone: string) =>
  `${formatTime(start, timeZone)} - ${formatTime(end, timeZone)}`;

type DayTimelineProps = {
  sessions: Session[];
  timers: Timer[];
  timeZone?: string;
};

const DayTimeline = ({ sessions, timers, timeZone }: DayTimelineProps) => {
  const zone = timeZone ?? getClientTimezone();
  const timerMap = useMemo(() => {
    return new Map(timers.map((timer) => [timer.id, timer]));
  }, [timers]);

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [sessions]
  );

  const blocks = sortedSessions.map((session) => {
    const timer = timerMap.get(session.timer_id);
    const start = new Date(session.start_at);
    const end = session.end_at ? new Date(session.end_at) : new Date();
    const startMin = getMinutesSinceMidnight(start, zone);
    const endMin = getMinutesSinceMidnight(end, zone);
    const clampedStart = clamp(startMin, 0, 24 * 60);
    const clampedEnd = clamp(endMin, 0, 24 * 60);
    const duration = Math.max(1, clampedEnd - clampedStart);

    return {
      session,
      timer,
      top: clampedStart * PX_PER_MINUTE,
      height: Math.max(MIN_BLOCK_HEIGHT, duration * PX_PER_MINUTE),
      timeRange: formatRange(start, end, zone),
    };
  });

  const timelineHeight = 24 * 60 * PX_PER_MINUTE;

  return (
    <div className="day-timeline">
      <div className="timeline-scale" style={{ height: timelineHeight }}>
        {Array.from({ length: 13 }).map((_, index) => {
          const hour = index * 2;
          return (
            <div
              className="timeline-tick"
              key={hour}
              style={{ top: hour * 60 * PX_PER_MINUTE }}
            >
              <span>{hour.toString().padStart(2, "0")}:00</span>
            </div>
          );
        })}
      </div>
      <div className="timeline-canvas" style={{ height: timelineHeight }}>
        {blocks.length === 0 ? (
          <div className="timeline-empty">No sessions logged for this day.</div>
        ) : null}
        {blocks.map((block) => (
          <SessionBlock
            key={block.session.id}
            session={block.session}
            color={block.timer?.color ?? "#1d4ed8"}
            label={block.timer?.name ?? "Timer"}
            timeRange={block.timeRange}
            style={{ top: block.top, height: block.height }}
          />
        ))}
      </div>
    </div>
  );
};

export default DayTimeline;
