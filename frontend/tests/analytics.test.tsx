import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import StatsPage from "../src/routes/StatsPage";
import HistoryPage from "../src/routes/HistoryPage";
import { useAnalytics } from "../src/hooks/useAnalytics";
import { useDayStats } from "../src/hooks/useDayStats";
import { notifyStudyDataChanged } from "../src/api/dataEvents";

vi.mock("../src/contexts/AuthContext", () => ({ useAuth: () => ({ user: { username: "analytics-test" } }) }));
vi.mock("../src/context/TimerRuntimeContext", () => ({ useTimerRuntime: () => ({ activeSession: null }) }));
vi.mock("../src/utils/date", async (original) => ({ ...await original<object>(), getClientTimezone: () => "UTC" }));

const courseId = "11111111-1111-4111-8111-111111111111";
const archivedId = "22222222-2222-4222-8222-222222222222";
const courses = [
  { id: courseId, name: "Algorithms", color: "#7c83ff", is_archived: false },
  { id: archivedId, name: "Archived Physics", color: "#22c55e", is_archived: true },
].map((course) => ({ ...course, icon: "book", cycle_total_seconds: 0, created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" }));
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const analytics = (url: URL) => {
  const from = url.searchParams.get("from")!;
  const to = url.searchParams.get("to")!;
  const daily = [];
  for (let date = new Date(`${from}T00:00:00Z`); date.toISOString().slice(0, 10) <= to; date.setUTCDate(date.getUTCDate() + 1)) {
    const day_date = date.toISOString().slice(0, 10);
    daily.push({ day_date, recorded_seconds: day_date >= "2026-10-15" ? 3600 : 0, timed_seconds: day_date >= "2026-10-15" ? 1800 : 0, session_count: day_date >= "2026-10-15" ? 1 : 0 });
  }
  const total = daily.reduce((sum, day) => sum + day.recorded_seconds, 0);
  return { range: { from, to, client_tz: "UTC" }, summary: { recorded_seconds: total, timed_seconds: total / 2, session_count: total ? 1 : 0, active_days: total / 3600, day_count: daily.length, consistency_percent: total / 3600 / daily.length * 100, average_seconds_per_day: total / daily.length }, daily,
    weekly: [{ week_start: "2026-10-12", recorded_seconds: total, active_days: total / 3600, is_partial: true }],
    hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, timed_seconds: hour === 0 || hour === 23 ? total / 4 : 0 })), comparison: null };
};

const Location = () => {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output aria-label="Location">{location.pathname}{location.search}</output><button onClick={() => navigate(-1)}>Browser back</button></>;
};
const mount = (entry = "/stats?from=2026-10-15&to=2026-10-16") => render(
  <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Location /><Routes><Route path="/stats" element={<StatsPage />} /><Route path="/history" element={<HistoryPage />} /></Routes>
  </MemoryRouter>
);

let requests: URL[];
beforeEach(() => {
  requests = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-16T12:00:00Z"));
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    requests.push(url);
    if (url.pathname.endsWith("/timers")) return json({ timers: courses });
    if (url.pathname.endsWith("/analytics/sessions")) return json({ sessions: [{ id: "session-1", timer_id: archivedId, start_at: "2026-10-15T23:30:00Z", end_at: "2026-10-16T00:30:00Z", duration_seconds: 7200, range_recorded_seconds: 3600, range_timed_seconds: 1800, client_tz: "UTC", day_date: "2026-10-15", day_of_week: 3 }] });
    if (url.pathname.endsWith("/analytics")) return json(analytics(url));
    if (url.pathname.endsWith("/stats/day")) return json({ day_date: "2026-10-16", totals: [] });
    if (url.pathname.endsWith("/stats/week")) return json({ week_start: "2026-10-12", daily: [] });
    if (url.pathname.endsWith("/stats/averages")) return json({ days: 14, averages: [] });
    return json({ sessions: [] });
  }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("advanced analytics integration", () => {
  it("defaults to a 90-day overview with the original reports still available", async () => {
    mount("/stats");
    await screen.findByRole("heading", { name: "Study activity" });
    expect(requests.some((url) => url.searchParams.get("from") === "2026-07-19" && url.searchParams.get("to") === "2026-10-16")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Reports", exact: true }));
    expect(await screen.findByRole("heading", { name: "Day totals" })).toBeTruthy();
    expect(screen.getByLabelText("Week start")).toBeTruthy();
    expect(screen.getByLabelText("Days")).toBeTruthy();
    expect(screen.queryByLabelText("Course")).toBeNull();
  });

  it("applies archived course and year filters together and keeps zero days", async () => {
    mount();
    const select = await screen.findByLabelText("Course");
    expect(within(select).getByRole("group", { name: "Archived" })).toBeTruthy();
    fireEvent.change(select, { target: { value: archivedId } });
    fireEvent.click(screen.getByRole("button", { name: "12 months" }));
    await waitFor(() => expect(requests.some((url) => url.searchParams.get("timer_id") === archivedId && url.searchParams.get("from") === "2025-10-17")).toBe(true));
    await waitFor(() => expect(screen.getAllByRole("button", { name: /recorded.*session/i })).toHaveLength(365));
  });

  it("opens an activity-date History view for a day and restores filters on Back", async () => {
    mount(`/stats?from=2026-10-15&to=2026-10-16&timer_id=${archivedId}`);
    fireEvent.click(await screen.findByRole("button", { name: /October 16, 2026.*recorded/i }));
    await screen.findByRole("heading", { name: "History" });
    expect((screen.getByLabelText("From") as HTMLInputElement).value).toBe("2026-10-16");
    await waitFor(() => expect(requests.some((url) => url.pathname.endsWith("/analytics/sessions") && url.searchParams.get("timer_id") === archivedId && url.searchParams.get("client_tz") === "UTC")).toBe(true));
    expect((await screen.findAllByText("01:00:00")).length).toBeGreaterThan(0);
    expect(screen.getByText(/02:00:00.*full session/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Browser back" }));
    expect((await screen.findByLabelText("Course") as HTMLSelectElement).value).toBe(archivedId);
    expect(screen.getByLabelText("Location").textContent).toContain("from=2026-10-15");
  });

  it("moves calendar focus with arrow keys and exposes hovered day details", async () => {
    mount();
    const first = await screen.findByRole("button", { name: /October 15, 2026.*recorded/i });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement?.getAttribute("aria-label")).toContain("October 16, 2026");
    fireEvent.mouseEnter(first);
    expect(screen.getByRole("tooltip").textContent).toContain("October 15, 2026");
  });

  it("keeps the explicit History link available after calendar focus leaves", async () => {
    mount();
    const day = await screen.findByRole("button", { name: /October 15, 2026.*recorded/i });
    fireEvent.focus(day);
    fireEvent.blur(day);
    fireEvent.click(screen.getByRole("button", { name: "View sessions for Oct 15" }));
    expect(await screen.findByRole("heading", { name: "History" })).toBeTruthy();
  });

  it("rejects an invalid custom range without replacing the current results", async () => {
    mount("/stats");
    await screen.findByRole("heading", { name: "Study activity" });
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-10-17" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply range" }));
    expect(screen.getByRole("alert").textContent).toMatch(/range|date|after/i);
    expect(requests.some((url) => url.searchParams.get("from") === "2026-10-17")).toBe(false);
  });

  it("labels the unadjusted hourly activity and partial weeks", async () => {
    mount();
    expect(await screen.findByText(/Timer activity does not measure productivity/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Weekly trend" })).toBeTruthy();
    expect(screen.getByText(/two complete weeks/i)).toBeTruthy();
    fireEvent.focus(screen.getByRole("button", { name: /00:00.*timed/i }));
    expect(screen.getByRole("tooltip").textContent).toMatch(/50/);
  });

  it("retains zero days and avoids a fabricated peak for an empty selection", async () => {
    mount("/stats?from=2026-04-01&to=2026-04-02");
    expect(await screen.findByText(/No completed sessions in this range/)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /recorded.*0 sessions/ })).toHaveLength(2);
    expect(screen.getByText("No timed activity in this range.")).toBeTruthy();
    expect(screen.queryByText(/Most active:/)).toBeNull();
  });

  it("retries an analytics error without losing the selected filters", async () => {
    const normalFetch = globalThis.fetch;
    let failed = false;
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
      if (!failed && String(input).includes("/stats/analytics?")) { failed = true; return json({ detail: "Analytics temporarily unavailable" }, 503); }
      return normalFetch(input, init);
    }));
    mount(`/stats?from=2026-10-15&to=2026-10-16&timer_id=${archivedId}`);
    expect((await screen.findByRole("alert")).textContent).toContain("temporarily unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry analytics" }));
    expect(await screen.findByRole("heading", { name: "Study activity" })).toBeTruthy();
    expect((screen.getByLabelText("Course") as HTMLSelectElement).value).toBe(archivedId);
  });
});

describe("report request ordering and refresh", () => {
  it("does not restore an older daily report after a mutation-triggered reload", async () => {
    const pending: ((response: Response) => void)[] = [];
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => pending.push(resolve))));
    const { result } = renderHook(() => useDayStats("2026-10-16"));
    await waitFor(() => expect(pending).toHaveLength(1));
    act(notifyStudyDataChanged);
    await waitFor(() => expect(pending).toHaveLength(2));
    await act(async () => pending[1](json({ day_date: "2026-10-16", totals: [{ timer_id: courseId, total_seconds: 7200 }] })));
    await waitFor(() => expect(result.current.totals[0]?.total_seconds).toBe(7200));
    await act(async () => pending[0](json({ day_date: "2026-10-16", totals: [{ timer_id: courseId, total_seconds: 10 }] })));
    expect(result.current.totals[0].total_seconds).toBe(7200);
  });

  it("hides old filter data immediately and ignores late analytics responses", async () => {
    const pending: { resolve: (response: Response) => void; url: URL }[] = [];
    vi.stubGlobal("fetch", vi.fn((input) => new Promise<Response>((resolve) => pending.push({ resolve, url: new URL(String(input)) }))));
    const { result, rerender } = renderHook(({ timerId }) => useAnalytics("2026-10-15", "2026-10-16", "UTC", timerId, null), { initialProps: { timerId: null as string | null } });
    await waitFor(() => expect(pending).toHaveLength(1));
    rerender({ timerId: archivedId });
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(pending).toHaveLength(2));
    const newer = analytics(pending[1].url);
    newer.summary.recorded_seconds = 99;
    await act(async () => pending[1].resolve(json(newer)));
    await waitFor(() => expect(result.current.data?.summary.recorded_seconds).toBe(99));
    await act(async () => pending[0].resolve(json(analytics(pending[0].url))));
    expect(result.current.data?.summary.recorded_seconds).toBe(99);
  });

  it("refreshes on data changes and visible focus, but not unchanged session rerenders", async () => {
    const { result, rerender } = renderHook(({ session }) => useAnalytics("2026-10-15", "2026-10-16", "UTC", null, session), { initialProps: { session: "active-session" as string | null } });
    await waitFor(() => expect(result.current.data).toBeTruthy());
    const initial = requests.length;
    rerender({ session: "active-session" });
    expect(requests).toHaveLength(initial);
    act(notifyStudyDataChanged);
    await waitFor(() => expect(requests.length).toBe(initial + 1));
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(requests.length).toBe(initial + 2));
    rerender({ session: null });
    await waitFor(() => expect(requests.length).toBe(initial + 3));
  });
});
