import { useId, useRef, useState } from "react";
import { AnalyticsResponse } from "../../api/types";
import { formatCivilDate } from "../../utils/date";
import { formatDurationShort } from "../../utils/time";
import ChartTooltip from "./ChartTooltip";

export default function WeeklyTrend({ weeks, comparison }: { weeks: AnalyticsResponse["weekly"]; comparison: AnalyticsResponse["comparison"] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const max = Math.max(1, ...weeks.map((week) => week.recorded_seconds));
  const points = weeks.map((week, index) => ({ x: weeks.length === 1 ? 160 : 16 + index / (weeks.length - 1) * 288, y: 104 - week.recorded_seconds / max * 84 }));
  const current = selected === null ? null : weeks[selected];
  return <section className="panel analytics-chart" aria-labelledby="weekly-heading">
    <div className="analytics-section-heading"><h2 id="weekly-heading">Weekly trend</h2><span className="panel-meta">Recorded time</span></div>
    <div className="analytics-plot">
      {current ? <ChartTooltip id={id}>Week of {formatCivilDate(current.week_start)} · {formatDurationShort(current.recorded_seconds)} · {current.active_days} active days{current.is_partial ? " · Partial week" : ""}</ChartTooltip> : null}
      <div className="analytics-week-plot">
        <svg viewBox="0 0 320 120" preserveAspectRatio="none" role="img" aria-label="Weekly recorded study duration">
          <line x1="16" x2="304" y1="104" y2="104" className="analytics-grid-line" />
          <line x1="16" x2="304" y1="20" y2="20" className="analytics-grid-line analytics-grid-faint" />
          <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} className="analytics-trend-line" />
          {points.map((point, index) => <circle key={weeks[index].week_start} cx={point.x} cy={point.y} r={selected === index ? 3.5 : 2.5} className={weeks[index].is_partial ? "analytics-trend-point analytics-trend-partial" : "analytics-trend-point"} />)}
        </svg>
        {weeks.map((week, index) => <button key={week.week_start} ref={(node) => { refs.current[index] = node; }} type="button" className="analytics-week-hit"
          style={{ left: `${points[index].x / 320 * 100}%`, top: `${points[index].y / 120 * 100}%` }}
          tabIndex={index === (selected ?? weeks.length - 1) ? 0 : -1} aria-label={`Week of ${formatCivilDate(week.week_start)}, ${formatDurationShort(week.recorded_seconds)}${week.is_partial ? ", partial week" : ""}`}
          aria-describedby={selected === index ? id : undefined} onMouseEnter={() => setSelected(index)} onMouseLeave={() => setSelected(null)} onFocus={() => setSelected(index)} onBlur={() => setSelected(null)} onClick={() => setSelected(index)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            refs.current[Math.max(0, Math.min(weeks.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)))]?.focus();
          }} />)}
      </div>
      <div className="analytics-axis" aria-hidden="true"><span>{weeks.length ? formatCivilDate(weeks[0].week_start) : ""}</span><span>{formatDurationShort(max === 1 ? 0 : max)} peak</span><span>{weeks.length ? formatCivilDate(weeks[weeks.length - 1].week_start) : ""}</span></div>
    </div>
    <p className="analytics-insight">{comparison ? `${comparison.delta_seconds < 0 ? "−" : "+"}${formatDurationShort(Math.abs(comparison.delta_seconds))}${comparison.delta_percent === null ? "" : ` (${comparison.delta_percent > 0 ? "+" : ""}${comparison.delta_percent.toFixed(1)}%)`} vs previous complete week` : "Choose two complete weeks to compare."}</p>
    <p className="analytics-help">{comparison ? `Weeks of ${formatCivilDate(comparison.previous_week_start)} and ${formatCivilDate(comparison.current_week_start)}. ` : ""}Hollow points mark partial weeks.</p>
  </section>;
}
