import { useEffect, useId, useState } from "react";
import { Timer } from "../../api/types";
import { formatCivilDate, shiftCivilDate, validateAnalyticsRange } from "../../utils/date";

export type AnalyticsFiltersValue = { from: string; to: string; timerId: string | null; preset: string };

export default function AnalyticsFilters({ value, onChange, timers, loading, today, clientTz }: {
  value: AnalyticsFiltersValue;
  onChange: (value: AnalyticsFiltersValue) => void;
  timers: Timer[];
  loading: boolean;
  today: string;
  clientTz: string;
}) {
  const [customOpen, setCustomOpen] = useState(value.preset === "custom");
  const [draft, setDraft] = useState({ from: value.from, to: value.to });
  const [error, setError] = useState<string | null>(null);
  const courseLabelId = useId();
  useEffect(() => { setDraft({ from: value.from, to: value.to }); setError(null); setCustomOpen(value.preset === "custom"); }, [value.from, value.to, value.preset]);
  const choosePreset = (days: number) => {
    setCustomOpen(false);
    onChange({ ...value, from: shiftCivilDate(today, 1 - days), to: today, preset: `${days}d` });
  };
  const available = !value.timerId || timers.some((timer) => timer.id === value.timerId);
  return <div className="analytics-filters">
    <div className="analytics-filter-row">
      <label className="field analytics-course"><span id={courseLabelId}>Course</span><select aria-labelledby={courseLabelId} value={value.timerId ?? ""} disabled={loading} onChange={(event) => onChange({ ...value, timerId: event.target.value || null })}>
        <option value="">All Courses</option>
        {!available ? <option value={value.timerId!}>Course unavailable</option> : null}
        {timers.filter((timer) => !timer.is_archived).map((timer) => <option value={timer.id} key={timer.id}>{timer.name}</option>)}
        {timers.some((timer) => timer.is_archived) ? <optgroup label="Archived">{timers.filter((timer) => timer.is_archived).map((timer) => <option value={timer.id} key={timer.id}>{timer.name}</option>)}</optgroup> : null}
      </select></label>
      <div className="analytics-range-controls" role="group" aria-label="Date range">
        <button type="button" className={`chip ${value.preset === "90d" && !customOpen ? "chip-active" : ""}`} aria-pressed={value.preset === "90d" && !customOpen} onClick={() => choosePreset(90)}>3 months</button>
        <button type="button" className={`chip ${value.preset === "365d" && !customOpen ? "chip-active" : ""}`} aria-pressed={value.preset === "365d" && !customOpen} onClick={() => choosePreset(365)}>12 months</button>
        <button type="button" className={`chip ${customOpen ? "chip-active" : ""}`} aria-expanded={customOpen} onClick={() => setCustomOpen((open) => !open)}>Custom</button>
      </div>
    </div>
    {customOpen ? <form className="analytics-custom-range" noValidate onSubmit={(event) => {
      event.preventDefault();
      const message = validateAnalyticsRange(draft.from, draft.to, today);
      setError(message);
      if (!message) onChange({ ...value, ...draft, preset: "custom" });
    }}>
      <label className="field"><span>From</span><input type="date" value={draft.from} max={today} onChange={(event) => setDraft({ ...draft, from: event.target.value })} aria-invalid={Boolean(error)} /></label>
      <label className="field"><span>To</span><input type="date" value={draft.to} max={today} onChange={(event) => setDraft({ ...draft, to: event.target.value })} aria-invalid={Boolean(error)} /></label>
      <button type="submit" className="secondary">Apply range</button>
      {error ? <p className="error" role="alert">{error}</p> : null}
    </form> : null}
    <p className="analytics-range-label">{validateAnalyticsRange(value.from, value.to, today) ? "Choose a valid date range" : `${formatCivilDate(value.from, { month: "short", day: "numeric", year: "numeric" })} – ${formatCivilDate(value.to, { month: "short", day: "numeric", year: "numeric" })}`} <span>· {clientTz}</span>{value.preset === "90d" ? " · 90 days" : value.preset === "365d" ? " · 365 days" : ""}</p>
  </div>;
}
