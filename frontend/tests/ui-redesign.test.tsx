import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import TimerFormModal from "../src/components/TimerFormModal";
import TimersPage from "../src/routes/TimersPage";

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
    startTimer: vi.fn(),
    stopTimer: vi.fn(),
    offsets: {},
    adjustOffset: vi.fn(),
    elapsedByTimer: { [timer.id]: 4283 },
  }),
}));

vi.mock("../src/hooks/useTimers", () => ({
  useTimers: () => ({
    timers: [timer],
    loading: false,
    error: null,
    reload: vi.fn(),
    updateTimer: vi.fn(),
    archiveTimer: vi.fn(),
  }),
}));

afterEach(cleanup);

describe("compact timer workspace semantics", () => {
  it("exposes the selected timer and elapsed time to assistive technology", () => {
    render(<TimersPage />);

    expect(screen.getByRole("heading", { level: 1, name: "CSC311" })).toBeTruthy();
    expect(screen.getByRole("timer", { name: "Elapsed time" }).textContent).toBe("01:11:23");
    expect(screen.getByText("Ready")).toBeTruthy();
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
