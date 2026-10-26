import { useEffect, useRef, useState } from "react";

import { storageForAccount } from "../storage/accountStorage";
import { chooseScreensaverWallpaper, findScreensaverWallpaper, SCREENSAVER_WALLPAPERS } from "../utils/screensaverWallpapers";

const readSelection = (username: string) => {
  try {
    const saved = JSON.parse(storageForAccount(username).getItem("screensaverWallpaper") ?? "null");
    return findScreensaverWallpaper(saved?.wallpaperId)?.id ?? null;
  } catch { /* Wallpaper storage is optional presentation state. */ }
  return null;
};

/** Account containers remount on account changes. Only new running activations choose. */
export const useScreensaverWallpaper = (
  username: string,
  session: { id: string } | null,
) => {
  const [wallpaperId, setWallpaperId] = useState(() => readSelection(username));
  const current = useRef(wallpaperId);
  const activeId = session?.id ?? null;
  // A session present at mount is a restored running timer, not a start/resume.
  const previousActiveId = useRef(activeId);

  useEffect(() => {
    if (activeId === previousActiveId.current) return;
    previousActiveId.current = activeId;
    if (!activeId) return;
    const next = chooseScreensaverWallpaper(current.current).id;
    // Update the ref before React state so StrictMode's effect replay cannot draw twice.
    current.current = next;
    setWallpaperId(next);
    try { storageForAccount(username).setItem("screensaverWallpaper", JSON.stringify({ wallpaperId: next })); } catch { /* Keep the in-memory choice. */ }
  }, [activeId, username]);

  return findScreensaverWallpaper(wallpaperId) ?? SCREENSAVER_WALLPAPERS[0];
};
