import { CSSProperties, KeyboardEvent, useId, useRef, useState } from "react";
import { AnalyticsDay } from "../../api/types";
import { formatCivilDate } from "../../utils/date";
import { formatDurationShort } from "../../utils/time";
import ChartTooltip from "./ChartTooltip";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const intensity = (seconds: number) => seconds === 0 ? 0 : seconds < 1800 ? 1 : seconds < 3600 ? 2 : seconds < 7200 ? 3 : 4;
const fullDate = (date: string) => formatCivilDate(date, { month: "long", day: "numeric", year: "numeric" });
const dayDetails = (day: AnalyticsDay) => `${fullDate(day.day_date)} · ${formatDurationShort(day.recorded_seconds)} recorded · ${day.session_count} ${day.session_count === 1 ? "session" : "sessions"}`;

export default function ActivityHeatmap({ days, onSelectDay }: { days: AnalyticsDay[]; onSelectDay: (date: string) => void }) {
  const [focused, setFocused] = useState(days.length - 1);
  const [inspected, setInspected] = useState<number | null>(null);
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const touch = useRef(false);
  const touchSelected = useRef<number | null>(null);
  const tooltipId = useId();
  if (!days.length) return null;
  const weekday = (new Date(`${days[0].day_date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const weekCount = Math.ceil((weekday + days.length) / 7);
  const bands = Array.from({ length: Math.ceil(weekCount / 14) }, (_, band) =>
    Array.from({ length: Math.min(14, weekCount - band * 14) }, (_, offset) => band * 14 + offset));

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = { ArrowDown: 1, ArrowUp: -1, ArrowRight: 7, ArrowLeft: -7 }[event.key];
    if (step === undefined && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next = Math.max(0, Math.min(days.length - 1, event.key === "Home" ? index - (index + weekday) % 7 : event.key === "End" ? index + 6 - (index + weekday) % 7 : index + (step ?? 0)));
    setFocused(next);
    buttons.current.get(next)?.focus();
  };

  return <section className="panel analytics-activity" aria-labelledby="activity-heading">
    <div className="analytics-section-heading"><h2 id="activity-heading">Study activity</h2><span className="panel-meta">Recorded time</span></div>
    <div className="analytics-plot analytics-calendar-wrap">
      {inspected !== null && days[inspected] ? <ChartTooltip id={tooltipId}>{dayDetails(days[inspected])}</ChartTooltip> : null}
      <div className="analytics-calendar" style={{ "--calendar-weeks": weekCount } as CSSProperties} aria-label="Daily study calendar">
        {bands.map((weeks, band) => <div className="analytics-calendar-band" key={band} style={{ "--band-weeks": Math.min(14, weekCount) } as CSSProperties}>
          <div className="analytics-calendar-weekdays" aria-hidden="true"><span />{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
          {weeks.map((week) => {
            const firstIndex = week * 7 - weekday;
            const firstValid = days[Math.max(0, firstIndex)];
            const label = firstValid && (week === 0 || firstValid.day_date.slice(8) <= "07") ? formatCivilDate(firstValid.day_date, { month: "short" }) : "";
            return <div className="analytics-calendar-week" key={week}>
              <span className="analytics-month" aria-hidden="true">{label}</span>
              {Array.from({ length: 7 }, (_, row) => {
                const index = firstIndex + row;
                const day = days[index];
                if (!day) return <span className="analytics-calendar-padding" key={row} aria-hidden="true" />;
                return <button key={day.day_date} type="button" className="analytics-calendar-cell" data-level={intensity(day.recorded_seconds)}
                  ref={(node) => { if (node) buttons.current.set(index, node); else buttons.current.delete(index); }}
                  tabIndex={index === Math.min(focused, days.length - 1) ? 0 : -1} aria-label={dayDetails(day)} aria-describedby={inspected === index ? tooltipId : undefined}
                  onMouseEnter={() => setInspected(index)} onMouseLeave={() => setInspected(null)}
                  onFocus={() => { setFocused(index); setInspected(index); }} onBlur={() => setInspected(null)}
                  onKeyDown={(event) => move(event, index)} onPointerDown={(event) => { touch.current = event.pointerType === "touch"; }}
                  onClick={() => {
                    if (touch.current && touchSelected.current !== index) { touchSelected.current = index; setInspected(index); setFocused(index); }
                    else onSelectDay(day.day_date);
                    touch.current = false;
                  }} />;
              })}
            </div>;
          })}
        </div>)}
      </div>
    </div>
    <div className="analytics-calendar-footer"><span>{formatCivilDate(days[0].day_date)} – {formatCivilDate(days[days.length - 1].day_date)}</span>
      <div className="analytics-legend" aria-label="Duration levels: no time, under 30 minutes, 30 to 59 minutes, 1 to 2 hours, 2 or more hours"><span>Less</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} data-level={level} />)}<span>2h+</span></div>
    </div>
    <button type="button" className="link-button analytics-day-link" onClick={() => onSelectDay(days[Math.min(focused, days.length - 1)].day_date)}>View sessions for {formatCivilDate(days[Math.min(focused, days.length - 1)].day_date)}</button>
  </section>;
}
