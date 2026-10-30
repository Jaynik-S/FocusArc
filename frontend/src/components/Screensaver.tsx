import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import type { Timer } from "../api/types";
import { useTimerRuntime } from "../context/TimerRuntimeContext";
import { formatDuration } from "../utils/time";
import { SCREENSAVER_WALLPAPERS, type ScreensaverWallpaperDefinition } from "../utils/screensaverWallpapers";
import ScreensaverWallpaper, { type VisibleWallpaperFrame } from "./ScreensaverWallpaper";
import { normalizeScreensaverColor } from "../utils/screensaverRecolor";
import { useScreensaverTransition } from "../hooks/useScreensaverTransition";
import ScreensaverStardust from "./ScreensaverStardust";
import ScreensaverEnvironment from "./ScreensaverEnvironment";
import "./screensaver.css";

type ScreensaverProps = {
  isOpen: boolean;
  onExit: () => void;
  timer: Timer | null;
  elapsedSeconds?: number;
  wallpaper?: ScreensaverWallpaperDefinition;
  onVisibleChange?: (visible: boolean) => void;
  onRestoreFocus?: () => void;
};

const Screensaver = ({ isOpen, onExit, timer, elapsedSeconds, wallpaper = SCREENSAVER_WALLPAPERS[0], onVisibleChange, onRestoreFocus }: ScreensaverProps) => {
  const { activeSession, elapsedSeconds: activeElapsedSeconds, elapsedByTimer, busy, synced, error, stopTimer, adjustOffset } = useTimerRuntime();
  const [actionError, setActionError] = useState("");
  const [working, setWorking] = useState(false);
  const [visibleFrame, setVisibleFrame] = useState<VisibleWallpaperFrame | null>(null);
  const [admitted, setAdmitted] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const sessionId = activeSession?.id ?? null;
  const [activation, setActivation] = useState({ requested: isOpen, sessionId, sequence: 0 });
  if (activation.requested !== isOpen || activation.sessionId !== sessionId) {
    const starting = isOpen && (!activation.requested || activation.sessionId !== sessionId);
    setActivation({ requested: isOpen, sessionId, sequence: activation.sequence + (starting ? 1 : 0) });
    if (starting) { setVisibleFrame(null); setAdmitted(false); setLoadFailed(false); }
  }
  const hex = normalizeScreensaverColor(timer?.color ?? "#5e6ad2");
  const frameReady = visibleFrame?.source === wallpaper.source && visibleFrame.color === hex;
  const visible = isOpen && (admitted || frameReady);
  const failed = useCallback(() => setLoadFailed(true), []);
  const transition = useScreensaverTransition(isOpen ? activation.sequence + 1 : 0);
  const [origin, setOrigin] = useState({ x: "50%", y: "50%" });
  useLayoutEffect(() => {
    if (!isOpen) return;
    const dial = document.querySelector(".timer-dial")?.getBoundingClientRect();
    if (dial) setOrigin({ x: `${dial.left + dial.width / 2}px`, y: `${dial.top + dial.height / 2}px` });
  }, [isOpen, activation.sequence]);
  useLayoutEffect(() => { if (isOpen && frameReady) setAdmitted(true); }, [isOpen, frameReady]);
  const visibleWallpaper = SCREENSAVER_WALLPAPERS.find(item => item.source === visibleFrame?.source) ?? wallpaper;
  const ink = visibleWallpaper.ink;
  const layer = useRef<HTMLElement>(null);
  const pause = useRef<HTMLButtonElement>(null);
  const exit = useRef<HTMLButtonElement>(null);
  const focusOwner = useRef<HTMLElement | null>(null);
  const wasVisible = useRef(false);
  const disabled = busy || working || !synced || !activeSession;
  const displaySeconds = elapsedSeconds ?? Math.max(0,
    (timer ? elapsedByTimer[timer.id] ?? 0 : 0) + (activeSession?.timer_id === timer?.id ? activeElapsedSeconds : 0));

  useLayoutEffect(() => {
    // Capture before inert blurs the opener; restore after React's commit focus handling.
    if (visible && !wasVisible.current) focusOwner.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    wasVisible.current = visible;
    onVisibleChange?.(visible);
  }, [visible, onVisibleChange]);
  useEffect(() => { setActionError(""); }, [activeSession?.id]);
  useEffect(() => {
    if (layer.current) layer.current.inert = !visible;
    if (!visible) return;
    const previous = focusOwner.current;
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
      // Starting can disable/blur Play before artwork is ready; use the normal view's fallback.
      if (!previous || previous === document.body || document.activeElement !== previous) onRestoreFocus?.();
    };
  }, [visible, onExit, onRestoreFocus]);

  useEffect(() => {
    if (visible && disabled) exit.current?.focus({ preventScroll: true });
  }, [visible, disabled]);

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
    <>
    {isOpen && loadFailed && !visible ? <p className="screensaver-load-error" role="status">Could not prepare the screensaver. Your timer is still running; pause and resume to retry.</p> : null}
    <section ref={layer} className="screensaver" data-open={visible} data-preparing={isOpen && !visible} data-entered={admitted} data-transition={transition} data-activation={activation.sequence} data-wallpaper={visibleWallpaper.id} data-ink={ink} role="dialog" aria-modal={visible || undefined}
      style={{ "--portal-x": origin.x, "--portal-y": origin.y, "--entrance-accent": hex } as CSSProperties}
      aria-label="Timer screensaver" aria-hidden={!visible}>
      <div className="screensaver-scene" key={activation.sequence}>
      <ScreensaverWallpaper key={activation.sequence} enabled={isOpen} color={hex} source={wallpaper.source} onVisibleFrame={setVisibleFrame} onError={failed} />
      <ScreensaverEnvironment key={visibleWallpaper.id} scene={visibleWallpaper.id} color={visibleFrame?.color ?? hex} artwork={visibleFrame?.artwork ?? null} active={visible} />
      </div>
      {transition === "stardust" ? <ScreensaverStardust key={`dust-${activation.sequence}`} /> : null}
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
        <output className="screensaver-time" role="timer" aria-label="Elapsed time today">{formatDuration(displaySeconds)}</output>
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
    </>
  );
};

export default Screensaver;
