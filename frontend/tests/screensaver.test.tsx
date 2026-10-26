import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import Screensaver from "../src/components/Screensaver";
import type { Timer } from "../src/api/types";
import { SCREENSAVER_WALLPAPERS } from "../src/utils/screensaverWallpapers";

const state = vi.hoisted(() => ({ runtime: {} as Record<string, any>, frame: undefined as undefined | ((frame: { source: string; color: string }) => void) }));
vi.mock("../src/context/TimerRuntimeContext", () => ({ useTimerRuntime: () => state.runtime }));
vi.mock("../src/components/ScreensaverWallpaper", () => ({ ORIGINAL_ARTWORK_COLOR: "#377DC2", default: ({ color, onVisibleFrame }: any) => { state.frame = onVisibleFrame; return <div data-testid="screensaver-wallpaper" data-color={color} />; } }));
vi.mock("../src/components/ScreensaverEnvironment", () => ({ default: ({ scene, color }: any) => <canvas data-testid="environment" data-scene={scene} data-color={color} aria-hidden="true" /> }));
const timer = { id: "course", name: "Creative Focus", color: "#a56de2" } as Timer;
const exit = vi.fn();
const content = (isOpen = true, selected = timer, elapsedSeconds = 2530) => <Screensaver isOpen={isOpen} onExit={exit} timer={selected} elapsedSeconds={elapsedSeconds} />;

beforeEach(() => {
  state.runtime = { activeSession: { id: "session", timer_id: "course" }, busy: false, synced: true, error: "", stopTimer: vi.fn().mockResolvedValue(undefined), adjustOffset: vi.fn().mockResolvedValue(undefined) };
});
afterEach(cleanup);

it("renders live timer information and active controls with the matching wallpaper", () => {
  const view = render(content());
  expect(screen.getByRole("dialog", { name: "Timer screensaver" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Creative Focus" })).toBeTruthy();
  expect(screen.getByRole("timer").textContent).toBe("00:42:10");
  expect(screen.getByTestId("screensaver-wallpaper").getAttribute("data-color")).toBe("#a56de2");
  view.rerender(content(true, { ...timer, name: "Evening Flow", color: "#ff8855" }, 2531));
  expect(screen.getByRole("heading", { name: "Evening Flow" })).toBeTruthy();
  expect(screen.getByRole("timer").textContent).toBe("00:42:11");
  expect(screen.getByTestId("screensaver-wallpaper").getAttribute("data-color")).toBe("#ff8855");
});

it("calls the shared adjustment and pause commands without creating another timer", async () => {
  render(content());
  fireEvent.click(screen.getByRole("button", { name: /Add 10 minutes/ }));
  await waitFor(() => expect(state.runtime.adjustOffset).toHaveBeenCalledWith("course", 600));
  await waitFor(() => expect(screen.getByRole("button", { name: /Subtract 5 minutes/ }).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: /Subtract 5 minutes/ }));
  await waitFor(() => expect(state.runtime.adjustOffset).toHaveBeenCalledWith("course", -300));
  await waitFor(() => expect(screen.getByRole("button", { name: "Pause timer" }).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Pause timer" }));
  await waitFor(() => expect(state.runtime.stopTimer).toHaveBeenCalledTimes(1));
});

it("exits by button or Escape without mutating the timer and restores focus", () => {
  const opener = document.createElement("button");
  document.body.append(opener); opener.focus();
  const view = render(content(false));
  view.rerender(content());
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Pause timer" }));
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  expect(exit).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Exit screensaver" }));
  expect(exit).toHaveBeenCalledTimes(2);
  expect(state.runtime.stopTimer).not.toHaveBeenCalled();
  view.rerender(content(false));
  expect(document.activeElement).toBe(opener);
  expect(screen.queryByRole("dialog")).toBeNull();
  opener.remove();
});

it("traps keyboard focus, keeps exit available offline and displays sync failures", () => {
  state.runtime.synced = false; state.runtime.error = "Offline. Saved data retained.";
  render(content());
  const button = screen.getByRole("button", { name: "Exit screensaver" });
  button.focus();
  fireEvent.keyDown(button, { key: "Tab" });
  expect(document.activeElement).toBe(button);
  expect(screen.getByRole("button", { name: "Pause timer" }).disabled).toBe(true);
  expect(button.disabled).toBe(false);
  expect(screen.getByRole("status").textContent).toContain("Offline");
});

it("retains the running view and shows failed actions instead of claiming success", async () => {
  state.runtime.stopTimer.mockRejectedValueOnce(new Error("Reconnect before changing a timer."));
  render(content());
  fireEvent.click(screen.getByRole("button", { name: "Pause timer" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Reconnect");
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(exit).not.toHaveBeenCalled();
});

it("keeps keyboard exit available when busy or offline controls lose focus to the document", () => {
  const view = render(content());
  state.runtime.synced = false;
  view.rerender(content());
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Exit screensaver" }));
  (document.activeElement as HTMLElement).blur();
  fireEvent.keyDown(document.body, { key: "Tab" });
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Exit screensaver" }));
  fireEvent.keyDown(document.body, { key: "Escape" });
  expect(exit).toHaveBeenCalledTimes(1);
});

it("changes animation identity on displayed scenes, retaining its instance across color commits", () => {
  const [space, forest] = SCREENSAVER_WALLPAPERS;
  const view = render(<Screensaver isOpen onExit={exit} timer={timer} elapsedSeconds={1} wallpaper={space} />);
  const first = screen.getByTestId("environment");
  view.rerender(<Screensaver isOpen onExit={exit} timer={timer} elapsedSeconds={2} wallpaper={forest} />);
  expect(screen.getByTestId("environment")).toBe(first);
  expect(first.getAttribute("data-scene")).toBe("space");
  act(() => state.frame?.({ source: forest.source, color: "#A8D5BA" }));
  const second = screen.getByTestId("environment");
  expect(second).not.toBe(first);
  expect(second.getAttribute("data-scene")).toBe("forest");
  act(() => state.frame?.({ source: forest.source, color: "#FF0000" }));
  expect(screen.getByTestId("environment")).toBe(second);
  expect(second.getAttribute("data-color")).toBe("#FF0000");
});
