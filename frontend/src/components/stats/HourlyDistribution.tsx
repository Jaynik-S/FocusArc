import { useId, useRef, useState } from "react";
import { AnalyticsResponse } from "../../api/types";
import { formatDurationShort } from "../../utils/time";
import ChartTooltip from "./ChartTooltip";

const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

export default function HourlyDistribution({ hours }: { hours: AnalyticsResponse["hourly"] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [focused, setFocused] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const total = hours.reduce((sum, hour) => sum + hour.timed_seconds, 0);
  const maximum = Math.max(0, ...hours.map((hour) => hour.timed_seconds));
  const peaks = maximum ? hours.filter((hour) => hour.timed_seconds === maximum) : [];
  const current = selected === null ? null : hours[selected];
  return <section className="panel analytics-chart" aria-labelledby="hourly-heading">
    <div className="analytics-section-heading"><h2 id="hourly-heading">Study hours</h2><span className="panel-meta">By time of day</span></div>
    <div className="analytics-plot">
      {current ? <ChartTooltip id={id}>{hourLabel(current.hour)}–{hourLabel(current.hour + 1)} · {formatDurationShort(current.timed_seconds)} timed · {total ? (100 * current.timed_seconds / total).toFixed(1) : "0"}% of activity</ChartTooltip> : null}
      <div className="analytics-hour-bars" aria-label="Hourly timed activity">
        {hours.map((hour, index) => <button key={hour.hour} type="button" ref={(node) => { refs.current[index] = node; }}
          tabIndex={focused === index ? 0 : -1} className={`analytics-hour-bar${maximum > 0 && hour.timed_seconds === maximum ? " analytics-hour-peak" : ""}`}
          aria-label={`${hourLabel(hour.hour)}–${hourLabel(hour.hour + 1)}, ${formatDurationShort(hour.timed_seconds)} timed activity`}
          aria-describedby={selected === index ? id : undefined} onMouseEnter={() => setSelected(index)} onMouseLeave={() => setSelected(null)}
          onFocus={() => { setFocused(index); setSelected(index); }} onBlur={() => setSelected(null)} onClick={() => setSelected(index)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const next = Math.max(0, Math.min(hours.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)));
            refs.current[next]?.focus();
          }}>
          <span style={{ height: `${maximum ? 100 * hour.timed_seconds / maximum : 0}%` }} />
        </button>)}
      </div>
      <div className="analytics-axis" aria-hidden="true"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
    </div>
    <p className="analytics-insight">{peaks.length ? `Most active: ${peaks.slice(0, 3).map((hour) => hourLabel(hour.hour)).join(", ")}${peaks.length > 3 ? ` +${peaks.length - 3} more` : ""}` : "No timed activity in this range."}</p>
    <p className="analytics-help">Timed activity excludes manual duration adjustments. Timer activity does not measure productivity.</p>
  </section>;
}
