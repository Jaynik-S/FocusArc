import { useEffect, useRef, useState } from "react";

import type { Timer } from "../api/types";
import { useTimerRuntime } from "../context/TimerRuntimeContext";
import { formatDuration } from "../utils/time";
import { SCREENSAVER_WALLPAPERS, type ScreensaverWallpaperDefinition } from "../utils/screensaverWallpapers";
import ScreensaverWallpaper, { ORIGINAL_ARTWORK_COLOR, type VisibleWallpaperFrame } from "./ScreensaverWallpaper";
import ScreensaverEnvironment from "./ScreensaverEnvironment";
import "./screensaver.css";

type ScreensaverProps = {
  isOpen: boolean;
  onExit: () => void;
  timer: Timer | null;
  elapsedSeconds: number;
  wallpaper?: ScreensaverWallpaperDefinition;
};

const Screensaver = ({ isOpen, onExit, timer, elapsedSeconds, wallpaper = SCREENSAVER_WALLPAPERS[0] }: ScreensaverProps) => {
  const { activeSession, busy, synced, error, stopTimer, adjustOffset } = useTimerRuntime();
  const [actionError, setActionError] = useState("");
  const [working, setWorking] = useState(false);
  const [visibleFrame, setVisibleFrame] = useState<VisibleWallpaperFrame>({ source: wallpaper.source, color: ORIGINAL_ARTWORK_COLOR });
  const visibleWallpaper = SCREENSAVER_WALLPAPERS.find(item => item.source === visibleFrame.source) ?? wallpaper;
  const ink = visibleWallpaper.ink;
  const layer = useRef<HTMLElement>(null);
  const pause = useRef<HTMLButtonElement>(null);
  const exit = useRef<HTMLButtonElement>(null);
  const disabled = busy || working || !synced || !activeSession;

  useEffect(() => { setActionError(""); }, [activeSession?.id]);
  useEffect(() => {
    if (layer.current) layer.current.inert = !isOpen;
    if (!isOpen) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (pause.current?.disabled ? exit.current : pause.current)?.focus({ preventScroll: true });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onExit(); }
      if (event.key !== "Tab") return;
      const buttons = Array.from(layer.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (!layer.current?.contains(document.activeElement) ||
          (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus();
      }
    };
    // Disabled buttons can lose focus to BODY in Chromium, so listen outside the layer too.
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [isOpen, onExit]);

  useEffect(() => {
    if (isOpen && disabled) exit.current?.focus({ preventScroll: true });
  }, [isOpen, disabled]);

  const act = async (delta?: number) => {
    if (disabled || !timer || activeSession?.timer_id !== timer.id) return;
    setWorking(true); setActionError("");
    try {
      if (delta === undefined) await stopTimer();
      else await adjustOffset(timer.id, delta);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not update timer. Please try again.");
    } finally { setWorking(false); }
  };

  return (
    <section ref={layer} className="screensaver" data-open={isOpen} data-wallpaper={wallpaper.id} data-ink={ink} role="dialog" aria-modal={isOpen || undefined}
      aria-label="Timer screensaver" aria-hidden={!isOpen}>
      <ScreensaverWallpaper color={timer?.color ?? "#5e6ad2"} source={wallpaper.source} onVisibleFrame={setVisibleFrame} />
      <ScreensaverEnvironment key={visibleWallpaper.id} scene={visibleWallpaper.id} color={visibleFrame.color} artwork={visibleFrame.artwork ?? null} active={isOpen} />
      <button className="screensaver-exit" type="button" ref={exit} onClick={onExit} aria-label="Exit screensaver">
        <span aria-hidden="true">↙</span> Exit screensaver <kbd>Esc</kbd>
      </button>
      <div className="screensaver-body">
        <div className="screensaver-ornament" aria-hidden="true">
          <span />
          <svg viewBox="0 0 40 28" fill="none"><circle cx="20" cy="14" r="8" stroke="currentColor" strokeWidth="1.3" /><ellipse cx="20" cy="14" rx="17" ry="4.5" transform="rotate(-25 20 14)" stroke="currentColor" strokeWidth="1.3" /></svg>
          <span />
        </div>
        <h1 className="screensaver-name">{timer?.name ?? "Focus"}</h1>
        <output className="screensaver-time" role="timer" aria-label="Elapsed time today">{formatDuration(elapsedSeconds)}</output>
        <div className="screensaver-controls" aria-label="Active timer controls">
          <button type="button" onClick={() => void act(-300)} disabled={disabled} aria-label="Subtract 5 minutes">−5 <span>min</span></button>
          <button className="screensaver-pause" type="button" ref={pause} onClick={() => void act()} disabled={disabled} aria-label="Pause timer">
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="3" width="2.5" height="10" rx="0.6" /><rect x="9.5" y="3" width="2.5" height="10" rx="0.6" /></svg>
            Pause
          </button>
          <button type="button" onClick={() => void act(600)} disabled={disabled} aria-label="Add 10 minutes">+10 <span>min</span></button>
        </div>
      </div>
      <div className="screensaver-messages">
        {actionError ? <p role="alert">{actionError}</p> : null}
        {!synced ? <p role="status">{error || "Synchronizing study data… Timer controls will return when connected."}</p> : null}
      </div>
    </section>
  );
};

export default Screensaver;
