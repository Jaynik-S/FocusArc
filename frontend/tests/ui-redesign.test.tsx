import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import TimerFormModal from "../src/components/TimerFormModal";
import TimersPage from "../src/routes/TimersPage";

const state = vi.hoisted(() => ({ empty: false, startTimer: vi.fn(), reload: vi.fn() }));

const timer = {
  id: "timer-1",
  name: "CSC311",
  color: "#7c83ff",
  icon: "",
  cycle_total_seconds: 0,
  is_archived: false,
  created_at: "2026-09-27T12:00:00Z",
  updated_at: "2026-09-27T12:00:00Z",
};

vi.mock("../src/context/TimerSelectionContext", () => ({
  useSelectedTimer: () => ({
    selectedTimerId: timer.id,
    setSelectedTimerId: vi.fn(),
  }),
}));

vi.mock("../src/context/TimerRuntimeContext", () => ({
  useTimerRuntime: () => ({
    activeSession: null,
    elapsedSeconds: 0,
    busy: false,
    startTimer: state.startTimer,
    stopTimer: vi.fn(),
    offsets: {},
    adjustOffset: vi.fn(),
    elapsedByTimer: { [timer.id]: 4283 },
  }),
}));

vi.mock("../src/hooks/useTimers", () => ({
  useTimers: () => ({
    timers: state.empty ? [] : [timer],
    loading: false,
    error: null,
    reload: state.reload,
    updateTimer: vi.fn(),
    archiveTimer: vi.fn(),
  }),
}));

afterEach(() => { cleanup(); state.empty = false; state.startTimer.mockReset(); state.reload.mockReset(); });

describe("compact timer workspace semantics", () => {
  it("disables playback and adjustments when a stored selection no longer has a timer", () => {
    state.empty = true;
    render(<TimersPage />);
    expect(screen.getByRole("heading", { name: "Select a timer" })).toBeTruthy();
    for (const name of ["Play", "−5 min", "+10 min"]) {
      expect((screen.getByRole("button", { name, exact: true }) as HTMLButtonElement).disabled).toBe(true);
    }
  });
  it("exposes the selected timer and elapsed time to assistive technology", () => {
    render(<TimersPage />);

    expect(screen.getByRole("heading", { level: 1, name: "CSC311" })).toBeTruthy();
    expect(screen.getByRole("timer", { name: "Elapsed time" }).textContent).toBe("01:11:23");
    expect(screen.getByText("Ready")).toBeTruthy();
  });

  it("does not reload timer metadata after the runtime already reconciles a start", async () => {
    state.startTimer.mockResolvedValue(undefined);
    state.reload.mockResolvedValue(undefined);
    render(<TimersPage />);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => expect(state.startTimer).toHaveBeenCalledWith(timer.id));
    expect(state.reload).not.toHaveBeenCalled();
  });

  it("gives timer forms an accessible dialog name", () => {
    render(
      <TimerFormModal
        confirmLabel="Create"
        isOpen
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        title="Create timer"
      />
    );

    expect(screen.getByRole("dialog", { name: "Create timer" })).toBeTruthy();
  });
});
