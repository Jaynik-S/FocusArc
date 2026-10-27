import { useEffect, useLayoutEffect, useRef, useState } from "react";

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
  const activeId = session?.id ?? null;
  const [selection, setSelection] = useState(() => ({ activeId, wallpaperId: readSelection(username) }));
  const previousActiveId = useRef(activeId);

  // The activation tag prevents admission of an old choice while this effect commits.
  // Guard the draw with a ref so StrictMode cannot select twice.
  useLayoutEffect(() => {
    if (activeId === previousActiveId.current) return;
    previousActiveId.current = activeId;
    setSelection({ activeId, wallpaperId: activeId ? chooseScreensaverWallpaper(selection.wallpaperId).id : selection.wallpaperId });
  }, [activeId, selection.wallpaperId]);

  useEffect(() => {
    if (!selection.wallpaperId) return;
    try { storageForAccount(username).setItem("screensaverWallpaper", JSON.stringify({ wallpaperId: selection.wallpaperId })); } catch { /* Keep the in-memory choice. */ }
  }, [selection.wallpaperId, username]);

  return { ...(findScreensaverWallpaper(selection.wallpaperId) ?? SCREENSAVER_WALLPAPERS[0]), activationId: selection.activeId };
};
