import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { MASTER_SCREENSAVER, normalizeScreensaverColor } from "../utils/screensaverRecolor";
import { renderScreensaver } from "../utils/screensaverRenderer";

export type VisibleWallpaperFrame = { source: string; color: string; artwork?: HTMLCanvasElement | null };
const ScreensaverWallpaper = ({ color, source = MASTER_SCREENSAVER, enabled = true, onVisibleSource, onVisibleFrame, onError }: {
  color: string; source?: string; enabled?: boolean; onVisibleSource?: (source: string) => void; onVisibleFrame?: (frame: VisibleWallpaperFrame) => void; onError?: () => void;
}) => {
  const hex = normalizeScreensaverColor(color);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [painted, setPainted] = useState<{ hex: string; source: string } | null>(null);
  const [failed, setFailed] = useState(false);

  // Only decoded, committed pixels count as ready; raw artwork is never an entrance fallback.
  useLayoutEffect(() => { if (painted) onVisibleSource?.(painted.source); }, [painted, onVisibleSource]);
  useLayoutEffect(() => {
    if (painted) onVisibleFrame?.({ source: painted.source, color: painted.hex, artwork: canvas.current });
  }, [painted, onVisibleFrame]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setFailed(false);
    const paint = async () => {
      try {
        const blob = await renderScreensaver(hex, source);
        if (cancelled) return;
        const bitmap = await createImageBitmap(blob);
        try {
          if (cancelled || !canvas.current) return;
          const context = canvas.current.getContext("2d");
          if (!context) throw new Error("Canvas display is unavailable.");
          // Commit a fully decoded frame in one task; keep the old canvas visible while processing.
          canvas.current.width = bitmap.width; canvas.current.height = bitmap.height;
          context.drawImage(bitmap, 0, 0);
          setPainted({ hex, source });
        } finally { bitmap.close(); }
      } catch {
        if (cancelled) return;
        setFailed(true); onError?.();
      }
    };
    void paint();
    return () => { cancelled = true; };
  }, [hex, source, enabled, onError]);

  return <div className="screensaver-wallpaper" data-testid="screensaver-wallpaper" data-color={painted?.hex ?? ""} data-source={painted?.source ?? source}
    data-render-state={failed ? "error" : painted?.hex === hex && painted.source === source ? "ready" : "loading"} aria-hidden="true">
    <canvas ref={canvas} style={{ visibility: painted ? "visible" : "hidden" }} />
  </div>;
};

export default ScreensaverWallpaper;
