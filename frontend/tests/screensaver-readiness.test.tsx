import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Screensaver from "../src/components/Screensaver";
import type { Timer } from "../src/api/types";
import { SCREENSAVER_WALLPAPERS } from "../src/utils/screensaverWallpapers";

const state = vi.hoisted(() => ({ render: vi.fn(), runtime: {} as any }));
vi.mock("../src/utils/screensaverRenderer", () => ({ renderScreensaver: state.render }));
vi.mock("../src/context/TimerRuntimeContext", () => ({ useTimerRuntime: () => state.runtime }));
vi.mock("../src/components/ScreensaverEnvironment", () => ({ default: ({ active, scene, color }: any) => <div data-testid="environment" data-active={active} data-scene={scene} data-color={color} /> }));
const timer = { id: "a", name: "Study", color: "#A8D5BA" } as Timer;
const pixels = new Blob(["frame"]);
const deferred = () => { let resolve!: (blob: Blob) => void; return { promise: new Promise<Blob>(done => { resolve = done; }), resolve: (blob = pixels) => resolve(blob) }; };
const content = (isOpen = true, index = 0, color = timer.color) => <Screensaver isOpen={isOpen} onExit={() => {}} timer={{ ...timer, color }} elapsedSeconds={1} wallpaper={SCREENSAVER_WALLPAPERS[index]} />;
beforeEach(() => {
  state.runtime = { activeSession: { id: "one", timer_id: "a" }, synced: true, busy: false };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as any);
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 10, height: 10, close: vi.fn() }));
  state.render.mockResolvedValue(pixels);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("keeps the timer view available until the exact selected HEX frame has been decoded", async () => {
  const pending = deferred(); state.render.mockReturnValueOnce(pending.promise);
  render(content());
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByTestId("environment").getAttribute("data-active")).toBe("false");
  await act(async () => pending.resolve());
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByTestId("environment").getAttribute("data-color")).toBe("#A8D5BA");
});

it("never admits the previous canvas on a new activation or an obsolete render completion", async () => {
  const view = render(content());
  await screen.findByRole("dialog");
  view.rerender(content(false));
  const obsolete = deferred(); state.render.mockReturnValueOnce(obsolete.promise);
  state.runtime.activeSession = { id: "two", timer_id: "a" };
  view.rerender(content(true, 1));
  expect(screen.queryByRole("dialog")).toBeNull();
  view.rerender(content(false, 1));
  const latest = deferred(); state.render.mockReturnValueOnce(latest.promise);
  state.runtime.activeSession = { id: "three", timer_id: "a" };
  view.rerender(content(true, 2, "#FF5733"));
  await act(async () => obsolete.resolve());
  expect(screen.queryByRole("dialog")).toBeNull();
  await act(async () => latest.resolve());
  expect(screen.getByRole("dialog").getAttribute("data-wallpaper")).toBe("sky-garden");
  expect(screen.getByTestId("environment").getAttribute("data-scene")).toBe("sky-garden");
  expect(screen.getByTestId("environment").getAttribute("data-color")).toBe("#FF5733");
});

it("does not enter with raw artwork on failure, while keeping an already displayed HEX frame on update failure", async () => {
  state.render.mockRejectedValueOnce(new Error("Worker failed"));
  const view = render(content());
  await waitFor(() => expect(screen.getByTestId("screensaver-wallpaper").getAttribute("data-render-state")).toBe("error"));
  expect(screen.queryByRole("dialog")).toBeNull();
  state.runtime.activeSession = { id: "two", timer_id: "a" };
  view.rerender(content());
  await screen.findByRole("dialog");
  state.render.mockRejectedValueOnce(new Error("Worker failed"));
  view.rerender(content(true, 0, "#000000"));
  await waitFor(() => expect(screen.getByTestId("screensaver-wallpaper").getAttribute("data-render-state")).toBe("error"));
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByTestId("environment").getAttribute("data-color")).toBe("#A8D5BA");
});
