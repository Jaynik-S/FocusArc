import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import TimersPage from "../src/routes/TimersPage";
import HistoryPage from "../src/routes/HistoryPage";
import SchedulePage from "../src/routes/SchedulePage";
import StatsPage from "../src/routes/StatsPage";
import EndDayButton from "../src/components/EndDayButton";
import DayTimeline from "../src/components/DayTimeline";
import { TimerSelectionProvider, useSelectedTimer } from "../src/context/TimerSelectionContext";
import { accountStorageKey } from "../src/storage/accountStorage";

const state = vi.hoisted(() => ({ runtime: {} as Record<string, any>, sessionsArgs: [] as unknown[], scheduleDate: "", selected: "old" }));
const timers = [{ id: "old", name: "Old course", color: "#111827" }, { id: "running", name: "Running course", color: "#111827" }];
vi.mock("../src/context/TimerRuntimeContext", () => ({
  useTimerRuntime: () => state.runtime,
  useOptionalTimerRuntime: () => state.runtime,
  useTimerRuntimeState: () => state.runtime,
  useOptionalTimerRuntimeState: () => state.runtime,
}));
vi.mock("../src/hooks/useTimers", () => ({ useTimers: () => ({ timers, loading: false, reload: vi.fn() }) }));
vi.mock("../src/hooks/useReportingTimers", () => ({ useReportingTimers: () => ({ timers, loading: false }) }));
vi.mock("../src/hooks/useSessions", () => ({ useSessions: (...args: unknown[]) => { state.sessionsArgs = args; return { sessions: [], loading: false }; } }));
vi.mock("../src/hooks/useScheduleDay", () => ({ useScheduleDay: (day: string) => { state.scheduleDate = day; return { sessions: [], loading: false }; } }));
vi.mock("../src/hooks/useSessionAdjustment", () => ({ useSessionAdjustment: () => ({ busy: false, adjust: vi.fn() }) }));
vi.mock("../src/components/stats/StatsOverview", () => ({ default: ({ today, clientTz, filters }: any) => <output aria-label="Analytics query">{[today, clientTz, filters.from, filters.to].join(" ")}</output> }));
vi.mock("../src/components/stats/StatsReports", () => ({ default: ({ today, clientTz }: any) => <output aria-label="Report query">{today} {clientTz}</output> }));

beforeEach(() => {
  localStorage.clear();
  state.runtime = { activeSession: { id: "active", timer_id: "running" }, elapsedSeconds: 30, elapsedByTimer: { running: 120 }, offsets: {}, synced: true, busy: false, today: "2026-10-25", timeZone: "America/Toronto", nowMs: Date.parse("2026-10-25T15:30:00Z"), startTimer: vi.fn(), stopTimer: vi.fn(), adjustOffset: vi.fn(), resetTotals: vi.fn().mockResolvedValue({}) };
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
const router = (children: React.ReactNode) => <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{children}</MemoryRouter>;
const BrowseCourse = () => { const { setSelectedTimerId } = useSelectedTimer(); return <button onClick={() => setSelectedTimerId("old")}>Browse old course</button>; };

it("focuses the shared active course over stored selection without undoing local browsing", async () => {
  localStorage.setItem(accountStorageKey("sync-ui", "selectedTimerId"), "old");
  const content = () => router(<TimerSelectionProvider username="sync-ui"><TimersPage /><BrowseCourse /></TimerSelectionProvider>);
  const view = render(content());
  await waitFor(() => expect(screen.getByRole("heading", { name: "Running course" })).toBeTruthy());
  expect(screen.getByText("Today")).toBeTruthy();
  expect(screen.getByRole("timer").textContent).toBe("00:02:30");
  fireEvent.click(screen.getByRole("button", { name: "Browse old course" }));
  state.runtime = { ...state.runtime, elapsedSeconds: 31 };
  view.rerender(content());
  expect(screen.getByRole("heading", { name: "Old course" })).toBeTruthy();
  state.runtime = { ...state.runtime, activeSession: { id: "remote-switch", timer_id: "old" } };
  view.rerender(content());
  await waitFor(() => expect(screen.getByRole("heading", { name: "Old course" })).toBeTruthy());
});

it("disables timer commands while shared state is stale", () => {
  state.runtime.synced = false;
  render(router(<TimerSelectionProvider username="sync-ui"><TimersPage /></TimerSelectionProvider>));
  expect(screen.getByRole("heading", { name: "Running course" })).toBeTruthy();
  expect((screen.getByRole("button", { name: "Pause" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Edit timer" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Delete timer" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("status").textContent).toMatch(/sync|offline/i);
});

it("resets cycle counters through the guarded runtime and preserves the daily-total explanation", async () => {
  const ended = vi.fn();
  render(<EndDayButton onEnded={ended} />);
  fireEvent.click(screen.getByRole("button", { name: "Reset cycle counters" }));
  expect(screen.getByText(/today.*recorded study time remains intact/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(ended).toHaveBeenCalledOnce());
  expect(state.runtime.resetTotals).toHaveBeenCalledOnce();
});

it("retains ambiguous browser drafts and only applies a saved adjustment for the active session explicitly", async () => {
  state.runtime = { ...state.runtime, legacyPendingAdjustments: { active: 600, completed: 300 }, legacyPendingOffsets: { old: -300 }, applyLegacyAdjustment: vi.fn().mockResolvedValue(undefined) };
  render(router(<TimerSelectionProvider username="sync-ui"><TimersPage /></TimerSelectionProvider>));
  expect(screen.getByText(/saved browser adjustments.*retained for review.*excluded from shared totals/i)).toBeTruthy();
  expect(state.runtime.applyLegacyAdjustment).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Apply saved adjustment" }));
  await waitFor(() => expect(screen.getByText("Saved adjustment applied.")).toBeTruthy());
  expect(state.runtime.applyLegacyAdjustment).toHaveBeenCalledWith(state.runtime.activeSession, 600);
});

it("defaults History and Schedule to the shared account date and zone", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
  const view = render(router(<HistoryPage />));
  expect(state.sessionsArgs[0]).toBe("2026-10-24");
  expect(state.sessionsArgs[1]).toBe("2026-10-25");
  expect(state.sessionsArgs[3]).toMatchObject({ clientTz: "America/Toronto" });
  view.unmount();
  render(<SchedulePage />);
  expect(state.scheduleDate).toBe("2026-10-25");
  expect(screen.getByText("Sun Oct 25")).toBeTruthy();
});

it("passes the shared date and zone to both Stats views and preserves explicit ranges", () => {
  const view = render(<MemoryRouter initialEntries={["/?from=2026-08-01&to=2026-08-31&range=custom"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><StatsPage /></MemoryRouter>);
  expect(screen.getByLabelText("Analytics query").textContent).toBe("2026-10-25 America/Toronto 2026-08-01 2026-08-31");
  state.runtime = { ...state.runtime, today: "2026-10-26" };
  view.rerender(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><StatsPage /></MemoryRouter>);
  expect(screen.getByLabelText("Analytics query").textContent).toContain("2026-08-01 2026-08-31");
  fireEvent.click(screen.getByRole("button", { name: "Reports" }));
  expect(screen.getByLabelText("Report query").textContent).toBe("2026-10-26 America/Toronto");
});

it("uses the supplied shared clock for an active timeline block", () => {
  const session = { id: "active", timer_id: "running", start_at: "2026-10-25T15:00:00Z", end_at: null, day_date: "2026-10-25", day_of_week: 6, client_tz: "America/Toronto", duration_seconds: null };
  render(<DayTimeline sessions={[session]} timers={timers as any} timeZone="America/Toronto" dayDate="2026-10-25" nowMs={Date.parse("2026-10-25T15:30:00Z")} />);
  expect(screen.getByRole("button", { name: /Running course.*11:00.*11:30/ }).style.height).toBe("18px");
});

it("gives adjacent short sessions readable selection controls without stretching their timeline intervals", () => {
  const base = { day_date: "2026-10-25", day_of_week: 6, client_tz: "America/Toronto" };
  const sessions = [
    { ...base, id: "short-15", timer_id: "old", start_at: "2026-10-25T15:00:00Z", end_at: "2026-10-25T15:15:00Z", duration_seconds: 900 },
    { ...base, id: "short-23", timer_id: "running", start_at: "2026-10-25T15:15:00Z", end_at: "2026-10-25T15:38:00Z", duration_seconds: 1380 },
  ];
  render(<DayTimeline sessions={sessions} timers={timers as any} timeZone="America/Toronto" dayDate="2026-10-25" />);
  const choices = within(screen.getByRole("group", { name: "Short sessions" })).getAllByRole("button");
  expect(choices).toHaveLength(2);
  expect(choices[0].textContent).toContain("11:00 - 11:15");
  expect(choices[1].textContent).toContain("11:15 - 11:38");
  expect(screen.getByRole("button", { name: /Old course.*11:00.*11:15/ }).style.height).toBe("9px");
  expect(parseFloat(screen.getByRole("button", { name: /Running course.*11:15.*11:38/ }).style.height)).toBeCloseTo(13.8);
  fireEvent.click(choices[1]);
  expect(screen.getByRole("button", { name: "Add 10 minutes to session" })).toBeTruthy();
  expect(choices[1].getAttribute("aria-pressed")).toBe("true");
});
