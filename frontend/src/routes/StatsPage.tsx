import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { AnalyticsFiltersValue } from "../components/stats/AnalyticsFilters";
import StatsOverview from "../components/stats/StatsOverview";
import StatsReports from "../components/stats/StatsReports";
import { getLocalDateString, shiftCivilDate } from "../utils/date";
import * as TimerRuntime from "../context/TimerRuntimeContext";

export default function StatsPage() {
  const [params, setParams] = useSearchParams();
  const runtime = "useOptionalTimerRuntime" in TimerRuntime ? TimerRuntime.useOptionalTimerRuntime() : undefined;
  const clientTz = runtime?.timeZone ?? "America/Toronto";
  const today = runtime?.today ?? getLocalDateString(new Date(runtime?.nowMs ?? Date.now()), clientTz);
  const previousToday = useRef(today);
  const reports = params.get("view") === "reports";
  const preset = params.get("range") ?? (params.has("from") || params.has("to") ? "custom" : "90d");
  const filters: AnalyticsFiltersValue = { from: params.get("from") ?? shiftCivilDate(today, -89), to: params.get("to") ?? today, timerId: params.get("timer_id"), preset };
  const updateFilters = useCallback((next: AnalyticsFiltersValue) => {
    setParams((current) => {
      const query = new URLSearchParams(current);
      query.set("from", next.from); query.set("to", next.to); query.set("range", next.preset);
      if (next.timerId) query.set("timer_id", next.timerId); else query.delete("timer_id");
      return query;
    });
  }, [setParams]);

  useEffect(() => {
    if (previousToday.current === today) return;
    previousToday.current = today;
    if (preset === "90d" || preset === "365d") {
      const days = preset === "365d" ? 365 : 90;
      setParams((current) => { const next = new URLSearchParams(current); next.set("from", shiftCivilDate(today, 1 - days)); next.set("to", today); return next; }, { replace: true });
    }
  }, [today, preset, setParams]);

  return <div className="page minimal-page analytics-page">
    <div className="page-header"><div><h1>Stats</h1><p className="muted">A clearer view of your study habits.</p></div>
      <div className="analytics-tabs" role="group" aria-label="Stats views">
        {[false, true].map((isReports) => <button key={String(isReports)} type="button" className={`chip ${reports === isReports ? "chip-active" : ""}`} aria-pressed={reports === isReports}
          onClick={() => setParams((current) => { const next = new URLSearchParams(current); if (isReports) next.set("view", "reports"); else next.delete("view"); return next; })}>{isReports ? "Reports" : "Overview"}</button>)}
      </div>
    </div>
    {reports ? <StatsReports today={today} clientTz={clientTz} /> : <StatsOverview filters={filters} onChange={updateFilters} today={today} clientTz={clientTz} />}
  </div>;
}
