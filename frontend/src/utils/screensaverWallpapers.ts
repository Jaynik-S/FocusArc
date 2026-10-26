export const MASTER_SCREENSAVER = "/screensaver/master-screensaver.png";

/** Stable IDs are persisted; source paths also identify worker/cache entries. */
export const SCREENSAVER_WALLPAPERS = [
  { id: "space", name: "Starfield", source: MASTER_SCREENSAVER, ink: "light" },
  { id: "forest", name: "Moonlit forest", source: "/screensaver/master-screensaver-2.png", ink: "light" },
  { id: "sky-garden", name: "Sky garden", source: "/screensaver/master-screensaver-3.png", ink: "dark" },
  { id: "winter", name: "Winter lake", source: "/screensaver/master-screensaver-4.png", ink: "light" },
  { id: "village", name: "Lantern village", source: "/screensaver/master-screensaver-5.png", ink: "light" },
] as const;

export type ScreensaverWallpaperDefinition = typeof SCREENSAVER_WALLPAPERS[number];
export const findScreensaverWallpaper = (id: unknown) => SCREENSAVER_WALLPAPERS.find(item => item.id === id);

/** Uniform over eligible images; excluding the last keeps long-run chances symmetric. */
export const chooseScreensaverWallpaper = (previousId: string | null, random = Math.random) => {
  const alternatives = SCREENSAVER_WALLPAPERS.filter(item => item.id !== previousId);
  const pool = alternatives.length ? alternatives : SCREENSAVER_WALLPAPERS;
  return pool[Math.floor(random() * pool.length)];
};
