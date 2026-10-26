import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { createEnvironmentScene, environmentPalette, type EnvironmentId } from "../utils/screensaverAnimation";
import { drawScreensaverEnvironment } from "../utils/drawScreensaverEnvironment";

const ScreensaverEnvironment = ({ scene, color, active }: { scene: EnvironmentId; color: string; active: boolean }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const model = useMemo(() => createEnvironmentScene(scene), [scene]);
  const palette = useMemo(() => environmentPalette(color, scene === "sky-garden"), [color, scene]);
  const paletteRef = useRef(palette);
  const paintCurrent = useRef<(() => void) | null>(null);
  const clock = useRef({ scene, seconds: 0 });
  const [motion, setMotion] = useState("paused");
  useLayoutEffect(() => {
    paletteRef.current = palette;
    if (active) paintCurrent.current?.();
  }, [palette, active]);

  useEffect(() => {
    if (!active) { setMotion("paused"); return; }
    const target = canvas.current;
    if (!target) return;
    let context: CanvasRenderingContext2D | null = null;
    try { context = target.getContext("2d"); } catch { /* Artwork and timer remain usable without Canvas. */ }
    if (!context) return;
    const ctx = context;
    if (clock.current.scene !== scene) clock.current = { scene, seconds: 0 };
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let frame = 0; let lastStamp: number | null = null; let lastPaint = -Infinity;
    let width = 0; let height = 0; let dpr = 1;
    const resize = () => {
      const bounds = target.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      if (bounds.width === width && bounds.height === height && dpr === ratio) return;
      width = bounds.width; height = bounds.height; dpr = ratio;
      target.width = Math.max(1, Math.round(width * dpr)); target.height = Math.max(1, Math.round(height * dpr));
      lastPaint = -Infinity;
      paintCurrent.current?.();
    };
    const repaint = () => {
      if (!document.hidden && !media?.matches && width > 0 && height > 0) {
        drawScreensaverEnvironment(ctx, model, paletteRef.current, clock.current.seconds, width, height, dpr);
      }
    };
    const stop = () => { if (frame) cancelAnimationFrame(frame); frame = 0; lastStamp = null; lastPaint = -Infinity; };
    const tick = (stamp: number) => {
      frame = 0;
      if (document.hidden || media?.matches) return;
      if (lastStamp !== null) clock.current.seconds += Math.max(0, Math.min(.1, (stamp - lastStamp) / 1000));
      lastStamp = stamp;
      if (width > 0 && height > 0 && stamp - lastPaint >= 1000 / 30 - .5) {
        repaint();
        lastPaint = stamp;
      }
      frame = requestAnimationFrame(tick);
    };
    const reconcile = () => {
      stop();
      if (media?.matches) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, target.width, target.height); setMotion("reduced");
      } else if (document.hidden) setMotion("hidden");
      else { setMotion("running"); frame = requestAnimationFrame(tick); }
    };
    resize();
    paintCurrent.current = repaint;
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(target);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", reconcile);
    media?.addEventListener("change", reconcile);
    reconcile();
    return () => {
      paintCurrent.current = null; stop(); observer?.disconnect(); window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", reconcile); media?.removeEventListener("change", reconcile);
    };
  }, [active, model, scene]);

  return <canvas ref={canvas} className="screensaver-environment" data-scene={scene} data-color={color}
    data-motion={motion} aria-hidden="true" />;
};

export default ScreensaverEnvironment;
