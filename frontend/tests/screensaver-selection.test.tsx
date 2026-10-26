import { cleanup, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { chooseScreensaverWallpaper, SCREENSAVER_WALLPAPERS } from "../src/utils/screensaverWallpapers";
import { useScreensaverWallpaper } from "../src/hooks/useScreensaverWallpaper";
import { accountStorageKey } from "../src/storage/accountStorage";

beforeEach(() => localStorage.clear());
afterEach(cleanup);
const active = (id: string, timer_id = "course") => ({ id, timer_id });
const initial = { username: "wallpapers", session: null as ReturnType<typeof active> | null, day: "2026-10-26", reset: 0 };
const hook = (props = initial, strict = false) => renderHook(({ username, session }) => useScreensaverWallpaper(username, session), { initialProps: props, wrapper: strict ? StrictMode : undefined });

it("gives every image equal initial intervals and every non-previous image equal next intervals", () => {
  const ids = SCREENSAVER_WALLPAPERS.map(item => item.id);
  expect([0, 0.2, 0.4, 0.6, 0.8].map(value => chooseScreensaverWallpaper(null, () => value).id)).toEqual(ids);
  for (const previous of ids) {
    const selected = [0, 0.25, 0.5, 0.75].map(value => chooseScreensaverWallpaper(previous, () => value).id);
    expect(selected).toEqual(ids.filter(id => id !== previous));
  }
});

it("chooses on every start or resume without repeating, but not on pause or timer rerenders", () => {
  const random = vi.spyOn(Math, "random").mockReturnValue(0);
  const view = hook();
  expect(random).not.toHaveBeenCalled();
  view.rerender({ ...initial, session: active("first") });
  const first = view.result.current.id;
  view.rerender({ ...initial, session: active("first") });
  view.rerender({ ...initial, session: null });
  expect(random).toHaveBeenCalledTimes(1);
  view.rerender({ ...initial, session: active("resumed") });
  expect(view.result.current.id).not.toBe(first);
  expect(random).toHaveBeenCalledTimes(2);
  const resumed = view.result.current.id;
  view.rerender({ ...initial, session: active("other", "another-course") });
  expect(view.result.current.id).not.toBe(resumed);
  expect(random).toHaveBeenCalledTimes(3);
});

it("keeps a saved choice after refresh and scopes it to its account", () => {
  const random = vi.spyOn(Math, "random").mockReturnValue(0.9);
  const view = hook();
  view.rerender({ ...initial, session: active("first") });
  const first = view.result.current.id; view.unmount();
  const restored = hook({ ...initial, session: active("resumed") });
  expect(restored.result.current.id).toBe(first);
  expect(random).toHaveBeenCalledTimes(1);
  restored.unmount();
  const other = hook({ ...initial, username: "other-account" });
  other.rerender({ ...initial, username: "other-account", session: active("first") });
  expect(random).toHaveBeenCalledTimes(2);
});

it("does not treat mounting with an already running timer as another start", () => {
  const random = vi.spyOn(Math, "random").mockReturnValue(.5);
  const view = hook({ ...initial, session: active("restored") }, true);
  view.rerender({ ...initial, session: active("restored") });
  expect(random).not.toHaveBeenCalled();
  view.rerender({ ...initial, session: null });
  view.rerender({ ...initial, session: active("resumed") });
  expect(random).toHaveBeenCalledTimes(1);
});

it("does not choose on reset/day changes while running, and chooses on the next activation", () => {
  const random = vi.spyOn(Math, "random").mockReturnValue(0);
  const view = hook();
  view.rerender({ ...initial, session: active("first") });
  const first = view.result.current.id;
  view.rerender({ ...initial, session: active("first"), day: "2026-10-27", reset: 1 });
  expect(random).toHaveBeenCalledTimes(1);
  expect(view.result.current.id).toBe(first);
  view.rerender({ ...initial, session: null, reset: 1 });
  view.rerender({ ...initial, session: active("after-reset"), reset: 1 });
  expect(view.result.current.id).not.toBe(first);
  const second = view.result.current.id;
  view.rerender({ ...initial, session: active("after-reset"), reset: 1, day: "2026-10-27" });
  expect(view.result.current.id).toBe(second);
  expect(random).toHaveBeenCalledTimes(2);
});

it("draws once in StrictMode and survives corrupt or unavailable storage", () => {
  localStorage.setItem(accountStorageKey(initial.username, "screensaverWallpaper"), "broken");
  const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
  const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage full"); });
  const view = hook(initial, true);
  view.rerender({ ...initial, session: active("first") });
  const selected = view.result.current.id;
  view.rerender({ ...initial, session: active("first") });
  expect(view.result.current.id).toBe(selected);
  expect(random).toHaveBeenCalledTimes(1);
  expect(set).toHaveBeenCalled();
});

it("selects for a replacement session even if no paused snapshot was observed", () => {
  const random = vi.spyOn(Math, "random").mockReturnValue(0);
  const view = hook();
  view.rerender({ ...initial, session: active("before-reset") });
  view.rerender({ ...initial, session: active("before-reset"), reset: 1 });
  view.rerender({ ...initial, session: active("before-reset"), reset: 1 });
  expect(random).toHaveBeenCalledTimes(1);
  view.rerender({ ...initial, session: active("after-reset"), reset: 1 });
  expect(random).toHaveBeenCalledTimes(2);
});

it("handles repeated pause/resume of the same activation and reads old stored selections", () => {
  localStorage.setItem(accountStorageKey(initial.username, "screensaverWallpaper"), JSON.stringify({ day: initial.day, timerId: "course", wallpaperId: "space" }));
  const random = vi.spyOn(Math, "random").mockReturnValue(0);
  const view = hook();
  expect(view.result.current.id).toBe("space");
  view.rerender({ ...initial, session: active("first") });
  expect(view.result.current.id).toBe("forest");
  view.rerender({ ...initial, session: null });
  view.rerender({ ...initial, session: active("first") });
  expect(view.result.current.id).toBe("space");
  expect(random).toHaveBeenCalledTimes(2);
});
