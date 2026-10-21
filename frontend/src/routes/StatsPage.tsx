import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnalyticsFiltersValue } from "../components/stats/AnalyticsFilters";
import StatsOverview from "../components/stats/StatsOverview";
import StatsReports from "../components/stats/StatsReports";
import { getClientTimezone, getLocalDateString, shiftCivilDate } from "../utils/date";

export default function StatsPage() {
  const [params, setParams] = useSearchParams();
  const [clientTz, setClientTz] = useState(getClientTimezone);
  const [today, setToday] = useState(() => getLocalDateString(new Date(), clientTz));
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
    const checkDate = () => {
      const zone = getClientTimezone();
      setClientTz(zone);
      setToday(getLocalDateString(new Date(), zone));
    };
    const interval = window.setInterval(checkDate, 60000);
    window.addEventListener("focus", checkDate);
    document.addEventListener("visibilitychange", checkDate);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", checkDate); document.removeEventListener("visibilitychange", checkDate); };
  }, []);
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
    {reports ? <StatsReports /> : <StatsOverview filters={filters} onChange={updateFilters} today={today} clientTz={clientTz} />}
  </div>;
}
