import { cleanup, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { chooseScreensaverTransition, useScreensaverTransition } from "../src/hooks/useScreensaverTransition";

afterEach(cleanup);
it("gives each entrance an equal initial interval and each non-previous entrance an equal next interval", () => {
  expect([0, 1 / 3, 2 / 3].map(value => chooseScreensaverTransition(null, () => value))).toEqual(["portal", "parallax", "stardust"]);
  expect([0, .5].map(value => chooseScreensaverTransition("portal", () => value))).toEqual(["parallax", "stardust"]);
  expect([0, .5].map(value => chooseScreensaverTransition("parallax", () => value))).toEqual(["portal", "stardust"]);
  expect([0, .5].map(value => chooseScreensaverTransition("stardust", () => value))).toEqual(["portal", "parallax"]);
});
it("draws once per activation in StrictMode, independently of rerenders and ticks", () => {
  const random = vi.spyOn(Math, "random").mockReturnValue(0);
  const view = renderHook(({ sequence }) => useScreensaverTransition(sequence), { initialProps: { sequence: 0 }, wrapper: StrictMode });
  expect(random).not.toHaveBeenCalled();
  view.rerender({ sequence: 1 });
  expect(view.result.current).toBe("portal");
  expect(random).toHaveBeenCalledTimes(1);
  view.rerender({ sequence: 1 });
  view.rerender({ sequence: 1 });
  expect(random).toHaveBeenCalledTimes(1);
  view.rerender({ sequence: 2 });
  expect(view.result.current).toBe("parallax");
  expect(random).toHaveBeenCalledTimes(2);
});
