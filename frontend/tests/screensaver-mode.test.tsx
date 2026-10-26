import { act, cleanup, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, it } from "vitest";

import { useScreensaverMode } from "../src/hooks/useScreensaverMode";

afterEach(cleanup);

it("opens for a new activation, closes on pause, and reopens for resume or another timer", () => {
  const view = renderHook(({ id }) => useScreensaverMode(id), { initialProps: { id: null as string | null } });
  expect(view.result.current.isOpen).toBe(false);
  view.rerender({ id: "first" });
  expect(view.result.current.isOpen).toBe(true);
  view.rerender({ id: null });
  expect(view.result.current.isOpen).toBe(false);
  view.rerender({ id: "resumed" });
  expect(view.result.current.isOpen).toBe(true);
  view.rerender({ id: "another-timer" });
  expect(view.result.current.isOpen).toBe(true);
});

it("manual exit survives ticks, snapshot updates and adjustments for the same activation", () => {
  const view = renderHook(({ id }) => useScreensaverMode(id), { initialProps: { id: null as string | null } });
  view.rerender({ id: "first" });
  act(() => view.result.current.exit());
  view.rerender({ id: "first" });
  expect(view.result.current.isOpen).toBe(false);
  view.rerender({ id: "second" });
  expect(view.result.current.isOpen).toBe(true);
});

it("refresh with an active session starts normal even in StrictMode and writes no storage", () => {
  const before = localStorage.length;
  const view = renderHook(() => useScreensaverMode("restored"), { wrapper: StrictMode });
  expect(view.result.current.isOpen).toBe(false);
  view.unmount();
  expect(renderHook(() => useScreensaverMode("restored")).result.current.isOpen).toBe(false);
  expect(localStorage.length).toBe(before);
});

