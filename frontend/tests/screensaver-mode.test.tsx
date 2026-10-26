import { act, cleanup, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, it } from "vitest";

import { useScreensaverMode } from "../src/hooks/useScreensaverMode";
import { getScreensaverTheme } from "../src/utils/screensaverTheme";

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

it("selects authored palettes across the hue wrap and limits recoloring to preserve the illustration", () => {
  expect(getScreensaverTheme("#2299dd").name).toBe("blue");
  expect(getScreensaverTheme("#a56de2").name).toBe("purple");
  expect(getScreensaverTheme("#ff8855").name).toBe("orange");
  expect(getScreensaverTheme("#ff0033").name).toBe("orange");
  expect(getScreensaverTheme("#00ff00").filter).toBe("none");
  expect(getScreensaverTheme("invalid")).toEqual(getScreensaverTheme("#5e6ad2"));
});

it("uses a desaturated palette for neutral HEX colors without extreme brightness changes", () => {
  expect(getScreensaverTheme("#808080").filter).toBe("saturate(0.45)");
  expect(getScreensaverTheme("#000000").src).toBe(getScreensaverTheme("#ffffff").src);
});
