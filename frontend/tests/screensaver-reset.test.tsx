import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TimerRuntimeProvider, useTimerRuntime } from "../src/context/TimerRuntimeContext";

const sync = vi.hoisted(() => ({ resetTotals: vi.fn(), refresh: vi.fn(), startTimer: vi.fn(), stopTimer: vi.fn(), busy: false, synced: true, activeSession: null }));
vi.mock("../src/hooks/useStudySync", () => ({ useStudySync: () => sync }));
beforeEach(() => { localStorage.clear(); sync.resetTotals.mockResolvedValue({ totals: [] }); });
afterEach(cleanup);
const wrapper = ({ children }: { children: React.ReactNode }) => <TimerRuntimeProvider username="wallpaper-reset">{children}</TimerRuntimeProvider>;

it("invalidates wallpaper grouping only after a successful reset and preserves the response", async () => {
  const view = renderHook(useTimerRuntime, { wrapper });
  expect(view.result.current.wallpaperResetRevision).toBe(0);
  await act(async () => expect(await view.result.current.resetTotals()).toEqual({ totals: [] }));
  expect(view.result.current.wallpaperResetRevision).toBe(1);
});

it("does not invalidate the current study when reset fails", async () => {
  sync.resetTotals.mockRejectedValueOnce(new Error("Reconnect"));
  const view = renderHook(useTimerRuntime, { wrapper });
  await act(async () => { await expect(view.result.current.resetTotals()).rejects.toThrow("Reconnect"); });
  expect(view.result.current.wallpaperResetRevision).toBe(0);
});
