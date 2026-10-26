import { expect, it } from "vitest";
import { SCREENSAVER_WALLPAPERS } from "../src/utils/screensaverWallpapers";

it("registers all five supplied master illustrations with unique stable sources", () => {
  expect(SCREENSAVER_WALLPAPERS).toHaveLength(5);
  expect(new Set(SCREENSAVER_WALLPAPERS.map(item => item.id)).size).toBe(5);
  expect(new Set(SCREENSAVER_WALLPAPERS.map(item => item.source)).size).toBe(5);
  expect(SCREENSAVER_WALLPAPERS.map(item => item.source)).toEqual([
    "/screensaver/master-screensaver.png", "/screensaver/master-screensaver-2.png",
    "/screensaver/master-screensaver-3.png", "/screensaver/master-screensaver-4.png",
    "/screensaver/master-screensaver-5.png",
  ]);
  expect(SCREENSAVER_WALLPAPERS.find(item => item.id === "sky-garden")?.ink).toBe("dark");
});
