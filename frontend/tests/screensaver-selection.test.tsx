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
const hook = (props = initial, strict = false) => renderHook(({ username, session, day, reset }) => useScreensaverWallpaper(username, session, day, reset), { initialProps: props, wrapper: strict ? StrictMode : undefined });

it("gives every image equal initial intervals and every non-previous image equal next intervals", () => {
  const ids = SCREENSAVER_WALLPAPERS.map(item => item.id);
  expect([0, 0.2, 0.4, 0.6, 0.8].map(value => chooseScreensaverWallpaper(null, () => value).id)).toEqual(ids);
  for (const previous of ids) {
    const selected = [0, 0.25, 0.5, 0.75].map(value => chooseScreensaverWallpaper(previous, () => value).id);
    expect(selected).toEqual(ids.filter(id => id !== previous));
  }
});

it("selects only on a logical study boundary and preserves pause/resume and rerenders", () => {
  const random = vi.spyOn(Math, "random").mockReturnValue(0);
  const view = hook();
  expect(random).not.toHaveBeenCalled();
  view.rerender({ ...initial, session: active("first") });
  const first = view.result.current.id;
  view.rerender({ ...initial, session: active("first") });
  view.rerender({ ...initial, session: null });
  view.rerender({ ...initial, session: active("resumed") });
  expect(view.result.current.id).toBe(first);
  expect(random).toHaveBeenCalledTimes(1);
  view.rerender({ ...initial, session: active("other", "another-course") });
  expect(view.result.current.id).not.toBe(first);
  expect(random).toHaveBeenCalledTimes(2);
});

it("keeps a saved choice after refresh and scopes it to its account", () => {
  const random = vi.spyOn(Math, "random").mockReturnValue(0.9);
  const view = hook({ ...initial, session: active("first") });
  const first = view.result.current.id; view.unmount();
  const restored = hook({ ...initial, session: active("resumed") });
  expect(restored.result.current.id).toBe(first);
  expect(random).toHaveBeenCalledTimes(1);
  restored.unmount();
  hook({ ...initial, username: "other-account", session: active("first") });
  expect(random).toHaveBeenCalledTimes(2);
});

it("starts a fresh choice after reset or a new study day without repeating the previous image", () => {
  const random = vi.spyOn(Math, "random").mockReturnValue(0);
  const view = hook({ ...initial, session: active("first") });
  const first = view.result.current.id;
  view.rerender({ ...initial, session: null, reset: 1 });
  expect(random).toHaveBeenCalledTimes(1);
  view.rerender({ ...initial, session: active("after-reset"), reset: 1 });
  expect(view.result.current.id).not.toBe(first);
  const second = view.result.current.id;
  view.rerender({ ...initial, session: active("after-reset"), reset: 1, day: "2026-10-27" });
  expect(view.result.current.id).not.toBe(second);
  expect(random).toHaveBeenCalledTimes(3);
});

it("draws once in StrictMode and survives corrupt or unavailable storage", () => {
  localStorage.setItem(accountStorageKey(initial.username, "screensaverWallpaper"), "broken");
  const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
  const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage full"); });
  const view = hook({ ...initial, session: active("first") }, true);
  const selected = view.result.current.id;
  view.rerender({ ...initial, session: active("first") });
  expect(view.result.current.id).toBe(selected);
  expect(random).toHaveBeenCalledTimes(1);
  expect(set).toHaveBeenCalled();
});

it("waits for a fresh activation when the stopped snapshot trails an explicit reset", () => {
  const random = vi.spyOn(Math, "random").mockReturnValue(0);
  const view = hook({ ...initial, session: active("before-reset") });
  view.rerender({ ...initial, session: active("before-reset"), reset: 1 });
  view.rerender({ ...initial, session: active("before-reset"), reset: 1 });
  expect(random).toHaveBeenCalledTimes(1);
  view.rerender({ ...initial, session: active("after-reset"), reset: 1 });
  expect(random).toHaveBeenCalledTimes(2);
});
