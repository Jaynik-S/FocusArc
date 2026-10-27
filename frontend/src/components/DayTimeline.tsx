import { useEffect, useMemo, useState } from "react";

import { Session, Timer } from "../api/types";
import {
  formatTime,
  getClientTimezone,
  getLocalDateString,
} from "../utils/date";
import { dayBounds } from "../utils/timeline";
import { formatDuration } from "../utils/time";
import { useSessionAdjustment } from "../hooks/useSessionAdjustment";
import SessionAdjustmentControls from "./SessionAdjustmentControls";
import SessionBlock from "./SessionBlock";

const PX_PER_MINUTE = 0.6;
const MIN_BLOCK_HEIGHT = 8;
const MIN_LABEL_HEIGHT = 28;

const formatRange = (start: Date, end: Date, timeZone: string) =>
  `${formatTime(start, timeZone)} - ${formatTime(end, timeZone)}`;

type DayTimelineProps = {
  sessions: Session[];
  timers: Timer[];
  timeZone?: string;
  dayDate?: string;
  nowMs?: number;
  commandsDisabled?: boolean;
};

const DayTimeline = ({ sessions, timers, timeZone, dayDate, nowMs = Date.now(), commandsDisabled = false }: DayTimelineProps) => {
  const zone = timeZone ?? getClientTimezone();
  const day = dayDate ?? getLocalDateString(new Date(nowMs), zone);
  const bounds = useMemo(() => dayBounds(day, zone), [day, zone]);
  const [selected, setSelected] = useState<Session | null>(null);
  const adjustment = useSessionAdjustment();
  useEffect(() => {
    setSelected((current) => current ? sessions.find((session) => session.id === current.id) ?? current : null);
  }, [sessions]);
  const timerMap = useMemo(() => {
    return new Map(timers.map((timer) => [timer.id, timer]));
  }, [timers]);

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at)),
    [sessions]
  );

  const blocks = sortedSessions.map((session) => {
    const timer = timerMap.get(session.timer_id);
    const start = new Date(session.start_at);
    const end = session.end_at ? new Date(session.end_at) : new Date(nowMs);
    const clampedStart = Math.max(bounds.start, start.getTime());
    const clampedEnd = Math.min(bounds.end, end.getTime());
    const duration = Math.max(0, (clampedEnd - clampedStart) / 60000);
    const height = Math.max(MIN_BLOCK_HEIGHT, duration * PX_PER_MINUTE);
    const bottom = (clampedEnd - bounds.start) / 60000 * PX_PER_MINUTE;

    return {
      session,
      timer,
      top: Math.max(0, bottom - height),
      height,
      timeRange: formatRange(start, end, zone),
      lane: 0,
      lanes: 1,
    };
  });

  // Assign lanes to each connected group, including minimum-height zero markers.
  let group: typeof blocks = [];
  let groupEnd = -1;
  const laneEnds: number[] = [];
  const finishGroup = () => { group.forEach((block) => { block.lanes = laneEnds.length; }); };
  for (const block of blocks) {
    if (block.top >= groupEnd) {
      finishGroup();
      group = [];
      laneEnds.length = 0;
    }
    let lane = laneEnds.findIndex((end) => end <= block.top);
    if (lane < 0) lane = laneEnds.length;
    block.lane = lane;
    laneEnds[lane] = block.top + block.height;
    groupEnd = Math.max(...laneEnds);
    group.push(block);
  }
  finishGroup();
  const timelineHeight = (bounds.end - bounds.start) / 60000 * PX_PER_MINUTE;
  const ticks = Array.from({ length: Math.ceil((bounds.end - bounds.start) / 7200000) }, (_, i) => bounds.start + i * 7200000);
  const selectedTimer = selected ? timerMap.get(selected.timer_id) : null;
  const shortBlocks = blocks.filter((block) => block.height < MIN_LABEL_HEIGHT);

  return (
    <>
    {selected ? <div className="schedule-session-editor">
      <div><strong>{selectedTimer?.name ?? "Timer"}</strong><div className="muted">{formatRange(new Date(selected.start_at), selected.end_at ? new Date(selected.end_at) : new Date(nowMs), zone)} · {formatDuration(selected.duration_seconds ?? Math.max(0, Math.floor((nowMs - Date.parse(selected.start_at)) / 1000)))}</div></div>
      {selected.end_at ? <SessionAdjustmentControls busy={adjustment.busy || commandsDisabled} onAdjust={(delta) => {
        void adjustment.adjust(selected, delta).then((updated) => { if (updated) setSelected(updated); });
      }} /> : <span className="muted">Adjust the running timer on the Timers page.</span>}
    </div> : null}
    {adjustment.error ? <p className="error" role="alert">{adjustment.error}</p> : null}
    {adjustment.status ? <p className="muted" role="status">{adjustment.status}</p> : null}
    {shortBlocks.length > 0 ? <div className="schedule-session-choices" role="group" aria-label="Short sessions">
      {shortBlocks.map((block) => <button
        key={block.session.id}
        className="schedule-session-choice"
        type="button"
        aria-label={`Select ${block.timer?.name ?? "Timer"} session`}
        aria-describedby={`session-range-${block.session.id}`}
        aria-pressed={selected?.id === block.session.id}
        onClick={() => setSelected(block.session)}
      >
        <span className="schedule-session-choice-label"><span className="dot" style={{ background: block.timer?.color ?? "#1d4ed8" }} /><span>{block.timer?.name ?? "Timer"}</span></span>
        <span className="schedule-session-choice-meta" id={`session-range-${block.session.id}`}>{block.timeRange}</span>
      </button>)}
    </div> : null}
    <div className="day-timeline">
      <div className="timeline-scale" style={{ height: timelineHeight }}>
        {ticks.map((instant) => {
          return (
            <div
              className="timeline-tick"
              key={instant}
              style={{ top: (instant - bounds.start) / 60000 * PX_PER_MINUTE }}
            >
              <span>{formatTime(new Date(instant), zone)}</span>
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
            onSelect={() => setSelected(block.session)}
            selected={selected?.id === block.session.id}
            compact={block.height < MIN_LABEL_HEIGHT}
            style={{ top: block.top, height: block.height, left: `${block.lane / block.lanes * 100}%`, width: `calc(${100 / block.lanes}% - 8px)`, right: "auto" }}
          />
        ))}
      </div>
    </div>
    </>
  );
};

export default DayTimeline;
