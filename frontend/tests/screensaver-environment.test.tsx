import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ScreensaverEnvironment from "../src/components/ScreensaverEnvironment";

const state = vi.hoisted(() => ({ draw: vi.fn(), create: vi.fn((id: string) => ({ id })) }));
vi.mock("../src/utils/drawScreensaverEnvironment", () => ({ drawScreensaverEnvironment: state.draw }));
vi.mock("../src/utils/screensaverAnimation", async original => ({ ...await original<object>(), createEnvironmentScene: state.create }));
const frames = new Map<number, FrameRequestCallback>(); let nextFrame = 0;
let reduced = false; let mediaChanged: ((event: MediaQueryListEvent) => void) | undefined;
const clear = vi.fn(); const disconnect = vi.fn();
const media = { get matches() { return reduced; }, addEventListener: (_: string, callback: (event: MediaQueryListEvent) => void) => { mediaChanged = callback; }, removeEventListener: vi.fn() };
beforeEach(() => {
  frames.clear(); nextFrame = 0; reduced = false;
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ clearRect: clear, setTransform: vi.fn() } as any);
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 900, height: 700 } as DOMRect);
  vi.stubGlobal("devicePixelRatio", 3);
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { const id = ++nextFrame; frames.set(id, callback); return id; }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => frames.delete(id)));
  vi.stubGlobal("matchMedia", vi.fn(() => media));
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); disconnect = disconnect; });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const step = (time: number) => act(() => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(time)); });

it("keeps one loop/model across timer rerenders and updates palette without restarting motion", () => {
  const view = render(<ScreensaverEnvironment scene="space" color="#A8D5BA" active />);
  step(0); step(40);
  expect(state.draw).toHaveBeenCalledTimes(2);
  const seconds = state.draw.mock.calls[1][3];
  view.rerender(<ScreensaverEnvironment scene="space" color="#42216F" active />);
  expect(state.draw.mock.calls[2][3]).toBe(seconds);
  expect(state.draw.mock.calls[2][2].accent).not.toBe(state.draw.mock.calls[1][2].accent);
  step(80);
  expect(state.create).toHaveBeenCalledTimes(1);
  expect(state.draw.mock.calls[3][3]).toBeGreaterThan(seconds);
  expect(view.container.querySelector("canvas")?.width).toBe(1800);
  expect(view.container.querySelector("canvas")?.getAttribute("aria-hidden")).toBe("true");
});

it("stops hidden rendering and excludes hidden time when resumed", () => {
  render(<ScreensaverEnvironment scene="winter" color="#FFFFFF" active />);
  step(0); step(40); const before = state.draw.mock.calls.at(-1)![3];
  Object.defineProperty(document, "hidden", { configurable: true, value: true });
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(frames.size).toBe(0);
  step(10000); expect(state.draw).toHaveBeenCalledTimes(2);
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  act(() => document.dispatchEvent(new Event("visibilitychange"))); step(10040);
  expect(state.draw.mock.calls.at(-1)![3]).toBeCloseTo(before);
});

it("respects reduced motion changes and cancels resources on exit/unmount", () => {
  reduced = true;
  const view = render(<ScreensaverEnvironment scene="village" color="#FF0000" active />);
  expect(frames.size).toBe(0);
  expect(state.draw).not.toHaveBeenCalled();
  reduced = false; act(() => mediaChanged?.({ matches: false } as MediaQueryListEvent)); step(0);
  expect(state.draw).toHaveBeenCalledTimes(1);
  view.rerender(<ScreensaverEnvironment scene="village" color="#FF0000" active={false} />);
  expect(frames.size).toBe(0);
  view.unmount(); expect(disconnect).toHaveBeenCalled(); expect(media.removeEventListener).toHaveBeenCalled();
});

it("reads the native preference once and uses change events to stop and resume", () => {
  const reads = vi.spyOn(media, "matches", "get");
  render(<ScreensaverEnvironment scene="forest" color="#A8D5BA" active />);
  step(0); step(40); step(80);
  expect(reads).toHaveBeenCalledTimes(1);
  const draws = state.draw.mock.calls.length;
  reduced = true; act(() => mediaChanged?.({ matches: true } as MediaQueryListEvent));
  expect(frames.size).toBe(0);
  expect(clear).toHaveBeenCalled();
  step(120); expect(state.draw).toHaveBeenCalledTimes(draws);
  reduced = false; act(() => mediaChanged?.({ matches: false } as MediaQueryListEvent)); step(160);
  expect(state.draw).toHaveBeenCalledTimes(draws + 1);
  expect(reads).toHaveBeenCalledTimes(1);
});
