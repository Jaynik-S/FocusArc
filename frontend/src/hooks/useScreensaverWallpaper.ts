import { useEffect, useRef, useState } from "react";

import { storageForAccount } from "../storage/accountStorage";
import { chooseScreensaverWallpaper, findScreensaverWallpaper, SCREENSAVER_WALLPAPERS } from "../utils/screensaverWallpapers";

type Selection = { day: string; timerId: string | null; wallpaperId: string | null };
const readSelection = (username: string, day: string): Selection => {
  try {
    const saved = JSON.parse(storageForAccount(username).getItem("screensaverWallpaper") ?? "null");
    if (saved && typeof saved.day === "string" && (saved.timerId === null || typeof saved.timerId === "string") &&
        (saved.wallpaperId === null || findScreensaverWallpaper(saved.wallpaperId))) return saved;
  } catch { /* Wallpaper storage is optional presentation state. */ }
  return { day, timerId: null, wallpaperId: null };
};

/** Account containers remount on account changes. Pause keeps this logical study's image. */
export const useScreensaverWallpaper = (
  username: string,
  session: { id: string; timer_id: string } | null,
  day: string,
  resetRevision = 0,
) => {
  const [selection, setSelection] = useState(() => readSelection(username, day));
  const current = useRef(selection);
  const previousReset = useRef(resetRevision);
  const activeId = session?.id ?? null;
  const timerId = session?.timer_id ?? null;

  useEffect(() => {
    const explicitReset = resetRevision !== previousReset.current;
    previousReset.current = resetRevision;
    let next = current.current;
    if (explicitReset || next.day !== day) next = { ...next, day, timerId: null };
    // A reset can finish before its stopped snapshot arrives; choose on the next activation.
    if (!explicitReset && timerId && (next.timerId !== timerId || !next.wallpaperId)) {
      next = { day, timerId, wallpaperId: chooseScreensaverWallpaper(next.wallpaperId).id };
    }
    if (next === current.current) return;
    // Update the ref before React state so StrictMode's effect replay cannot draw twice.
    current.current = next;
    setSelection(next);
    try { storageForAccount(username).setItem("screensaverWallpaper", JSON.stringify(next)); } catch { /* Keep the in-memory choice. */ }
  }, [activeId, timerId, day, resetRevision, username]);

  return findScreensaverWallpaper(selection.wallpaperId) ?? SCREENSAVER_WALLPAPERS[0];
};
