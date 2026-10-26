import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { MASTER_SCREENSAVER, normalizeScreensaverColor } from "../utils/screensaverRecolor";
import { renderScreensaver } from "../utils/screensaverRenderer";

export type VisibleWallpaperFrame = { source: string; color: string; artwork?: HTMLCanvasElement | null };
export const ORIGINAL_ARTWORK_COLOR = "#377DC2";

const ScreensaverWallpaper = ({ color, source = MASTER_SCREENSAVER, onVisibleSource, onVisibleFrame }: {
  color: string; source?: string; onVisibleSource?: (source: string) => void; onVisibleFrame?: (frame: VisibleWallpaperFrame) => void;
}) => {
  const hex = normalizeScreensaverColor(color);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [painted, setPainted] = useState<{ hex: string; source: string } | null>(null);
  const [failed, setFailed] = useState(false);

  // Ink follows the actual retained canvas or raw fallback before the browser paints.
  useLayoutEffect(() => { onVisibleSource?.(painted?.source ?? source); }, [painted?.source, source, onVisibleSource]);
  useLayoutEffect(() => {
    onVisibleFrame?.({ source: painted?.source ?? source, color: painted?.hex ?? ORIGINAL_ARTWORK_COLOR, artwork: painted ? canvas.current : null });
  }, [painted?.source, painted?.hex, source, onVisibleFrame]);

  useEffect(() => {
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
        if (canvas.current) canvas.current.width = 0;
        setPainted(null); setFailed(true);
      }
    };
    void paint();
    return () => { cancelled = true; };
  }, [hex, source]);

  return <div className="screensaver-wallpaper" data-testid="screensaver-wallpaper" data-color={painted?.hex ?? ""} data-source={painted?.source ?? source}
    data-render-state={failed ? "fallback" : painted?.hex === hex && painted.source === source ? "ready" : "loading"}
    style={{ backgroundImage: `url("${source}")` }} aria-hidden="true">
    <canvas ref={canvas} style={{ visibility: painted ? "visible" : "hidden" }} />
  </div>;
};

export default ScreensaverWallpaper;
