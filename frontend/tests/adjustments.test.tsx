import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, Link } from "react-router-dom";
import { Session } from "../src/api/types";
import { TimerRuntimeProvider, useTimerRuntime } from "../src/context/TimerRuntimeContext";
import HistoryPage from "../src/routes/HistoryPage";
import SchedulePage from "../src/routes/SchedulePage";
import DayTimeline from "../src/components/DayTimeline";
import { notifyStudyDataChanged } from "../src/api/dataEvents";
import { accountStorageKey } from "../src/storage/accountStorage";

vi.mock("../src/contexts/AuthContext", () => ({ useAuth: () => ({ user: { username: "adjustments" } }) }));
vi.mock("../src/utils/date", async (original) => ({ ...await original<object>(), getClientTimezone: () => "UTC" }));

const initial: Session = { id: "session", timer_id: "course", start_at: "2026-01-02T05:05:00Z", end_at: "2026-01-02T05:35:00Z", duration_seconds: 1800, day_date: "2026-01-02", day_of_week: 4, client_tz: "America/Toronto" };
const timer = { id: "course", name: "Algorithms", color: "#7c83ff", icon: "book", cycle_total_seconds: 1800, is_archived: false, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
let session: Session;
let active: Session | null;
let fail: boolean;
let mutations: number;
let revision: number;
const studyState = (activeSession: Session | null = active) => ({
  username: "adjustments",
  changed: true, revision, server_now: new Date().toISOString(), study_timezone: "America/Toronto",
  day_date: "2026-01-02", day_start_at: "2026-01-02T05:00:00Z", day_end_at: "2026-01-03T05:00:00Z", lease_expires_at: null,
  active_session: activeSession, timers: [{ ...timer, completed_today_seconds: active ? 0 : Math.max(0, Math.floor((Date.parse(session.end_at!) - Math.max(Date.parse(session.start_at), Date.parse("2026-01-02T05:00:00Z"))) / 1000)) }],
});

beforeEach(() => {
  localStorage.clear();
  session = { ...initial };
  active = null;
  fail = false;
  mutations = 0;
  revision = 1;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-01-02T05:35:00Z"));
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/adjust")) {
      mutations++;
      if (fail) return json({ detail: "Could not save adjustment" }, 503);
      const body = JSON.parse(String(init?.body));
      expect(body.expected_start_at).toBe(session.start_at);
      expect(body.expected_end_at).toBe(session.end_at);
      const end = Date.parse(session.end_at ?? new Date().toISOString());
      const start = Math.min(Date.parse(session.start_at) - body.delta_seconds * 1000, end);
      session = { ...session, start_at: new Date(start).toISOString(), duration_seconds: active ? null : Math.floor((end - start) / 1000) };
      if (active) active = session;
      revision++;
      return json(session);
    }
    if (url.pathname.endsWith("/study-state")) return json(studyState());
    if (url.pathname.endsWith("/study-heartbeat")) return json({});
    if (url.pathname.endsWith("/active-session")) return json({ active_session: active });
    if (url.pathname.endsWith("/latest-session")) return json(session);
    if (url.pathname.endsWith("/stop")) {
      session = { ...session, end_at: new Date().toISOString(), duration_seconds: Math.floor((Date.now() - Date.parse(session.start_at)) / 1000) };
      active = null;
      revision++;
      return json({ stopped_session: session });
    }
    if (url.pathname.endsWith("/timers")) return json({ timers: [{ ...timer, cycle_total_seconds: active ? 0 : session.duration_seconds }] });
    if (url.pathname.endsWith("/schedule/day")) return json({ day_date: "2026-01-02", sessions: [session] });
    if (url.pathname.endsWith("/sessions")) return json({ sessions: [session] });
    throw new Error(`Unexpected request ${url.pathname}`);
  }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("session adjustment integration", () => {
  it("synchronizes History and Schedule edits and updates the block interval", async () => {
    render(<MemoryRouter initialEntries={["/history?from=2026-01-01&to=2026-01-02"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Link to="/history?from=2026-01-01&to=2026-01-02">History tab</Link><Link to="/schedule">Schedule tab</Link>
      <Routes><Route path="/history" element={<HistoryPage />} /><Route path="/schedule" element={<SchedulePage />} /></Routes>
    </MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /add 10 minutes/i }));
    await waitFor(() => expect(screen.getAllByText("00:40:00").length).toBeGreaterThan(0));
    expect(screen.getByText(/23:55 - 00:35/)).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Schedule tab" }));
    const block = await screen.findByRole("button", { name: /Algorithms.*23:55.*00:35/i });
    expect(block.style.top).toBe("0px");
    expect(block.style.height).toBe("21px");
    fireEvent.click(block);
    fireEvent.click(screen.getByRole("button", { name: /subtract 5 minutes/i }));
    await waitFor(() => expect(session.duration_seconds).toBe(2100));
    fireEvent.click(screen.getByRole("link", { name: "History tab" }));
    await waitFor(() => expect(screen.getAllByText("00:35:00").length).toBeGreaterThan(0));
    expect(screen.getByText(/00:00 - 00:35/)).toBeTruthy();
    expect(mutations).toBe(2);
  });

  it("shows an API failure without changing the displayed session or replaying it", async () => {
    fail = true;
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><HistoryPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /add 10 minutes/i }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText("00:30:00").length).toBeGreaterThan(0));
    expect(session.start_at).toBe(initial.start_at);
    expect(mutations).toBe(1);
  });

  it("persists active adjustments once and recovers them after remounting", async () => {
    active = session = { ...initial, end_at: null, duration_seconds: null };
    const wrapper = ({ children }: { children: React.ReactNode }) => <TimerRuntimeProvider username="adjustments">{children}</TimerRuntimeProvider>;
    const first = renderHook(() => useTimerRuntime(), { wrapper });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    await act(async () => { await first.result.current.adjustOffset("course", 600); });
    await waitFor(() => expect(first.result.current.elapsedSeconds).toBe(2100));
    first.unmount();
    const recovered = renderHook(() => useTimerRuntime(), { wrapper });
    await waitFor(() => expect(recovered.result.current.elapsedSeconds).toBe(2100));
    await act(async () => { await recovered.result.current.stopTimer(); });
    await waitFor(() => expect(recovered.result.current.elapsedByTimer.course).toBe(2100));
    expect(recovered.result.current.offsets.course ?? 0).toBe(0);
    expect(mutations).toBe(1);
    expect(session.duration_seconds).toBe(2400);
  });

  it("adjusts a paused session without including the pause", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <TimerRuntimeProvider username="adjustments">{children}</TimerRuntimeProvider>;
    const hook = renderHook(() => useTimerRuntime(), { wrapper });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    vi.setSystemTime(new Date("2026-01-02T06:35:00Z"));
    await act(async () => { await hook.result.current.adjustOffset("course", 600); });
    await waitFor(() => expect(hook.result.current.elapsedByTimer.course).toBe(2100));
    expect(session.end_at).toBe(initial.end_at);
    expect(session.start_at).toBe("2026-01-02T04:55:00.000Z");
  });

  it("lays out overlapping sessions in distinct accessible columns", () => {
    const overlapping = { ...initial, id: "overlap", start_at: "2026-01-02T00:15:00Z" };
    render(<DayTimeline sessions={[initial, overlapping]} timers={[timer]} timeZone="UTC" dayDate="2026-01-02" />);
    const blocks = screen.getAllByRole("button", { name: /Algorithms.*05:35/i });
    expect(blocks).toHaveLength(2);
    expect(blocks[0].style.left).not.toBe(blocks[1].style.left);
  });

  it("keeps the visual end fixed when a short session is clamped to zero", () => {
    const short = { ...initial, start_at: "2026-01-02T00:30:00Z", duration_seconds: 300 };
    const view = render(<DayTimeline sessions={[short]} timers={[timer]} timeZone="UTC" dayDate="2026-01-02" />);
    const original = screen.getByRole("button", { name: /Algorithms.*05:35/i });
    const bottom = parseFloat(original.style.top) + parseFloat(original.style.height);
    view.rerender(<DayTimeline sessions={[{ ...short, start_at: short.end_at!, duration_seconds: 0 }]} timers={[timer]} timeZone="UTC" dayDate="2026-01-02" />);
    const zero = screen.getByRole("button", { name: /Algorithms.*05:35/i });
    expect(parseFloat(zero.style.top) + parseFloat(zero.style.height)).toBe(bottom);
  });

  it("refreshes immediately after an old in-flight poll when another view changes data", async () => {
    active = session = { ...initial, end_at: null, duration_seconds: null };
    const wrapper = ({ children }: { children: React.ReactNode }) => <TimerRuntimeProvider username="adjustments">{children}</TimerRuntimeProvider>;
    const hook = renderHook(() => useTimerRuntime(), { wrapper });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    let finish!: (response: Response) => void;
    const oldSnapshot = studyState({ ...session });
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((done) => { finish = done; }));
    let pending!: Promise<void>;
    act(() => { pending = hook.result.current.refresh(); });
    session = active = { ...session, start_at: "2026-01-02T04:55:00Z" };
    revision++;
    act(() => notifyStudyDataChanged());
    await act(async () => { finish(json(oldSnapshot)); await pending; });
    await waitFor(() => expect(hook.result.current.elapsedSeconds).toBe(2100));
  });

  it("does not reapply legacy browser offsets to an already completed session", async () => {
    localStorage.setItem(accountStorageKey("adjustments", "sessionAdjustments"), '{"session":600}');
    const wrapper = ({ children }: { children: React.ReactNode }) => <TimerRuntimeProvider username="adjustments">{children}</TimerRuntimeProvider>;
    const hook = renderHook(() => useTimerRuntime(), { wrapper });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => { await hook.result.current.adjustOffset("course", 600); });
    await waitFor(() => expect(hook.result.current.elapsedByTimer.course).toBe(2100));
    expect(session.duration_seconds).toBe(2400);
  });
});
