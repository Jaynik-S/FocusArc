import { KeyboardEvent, useEffect, useRef, useState } from "react";

import type { Timer } from "../api/types";
import { useTimerRuntime } from "../context/TimerRuntimeContext";
import { getScreensaverTheme } from "../utils/screensaverTheme";
import { formatDuration } from "../utils/time";
import "./screensaver.css";

type ScreensaverProps = {
  isOpen: boolean;
  onExit: () => void;
  timer: Timer | null;
  elapsedSeconds: number;
};

const Screensaver = ({ isOpen, onExit, timer, elapsedSeconds }: ScreensaverProps) => {
  const { activeSession, busy, synced, error, stopTimer, adjustOffset } = useTimerRuntime();
  const [actionError, setActionError] = useState("");
  const [working, setWorking] = useState(false);
  const layer = useRef<HTMLElement>(null);
  const pause = useRef<HTMLButtonElement>(null);
  const exit = useRef<HTMLButtonElement>(null);
  const theme = getScreensaverTheme(timer?.color ?? "#5e6ad2");
  const disabled = busy || working || !synced || !activeSession;

  useEffect(() => { setActionError(""); }, [activeSession?.id]);
  useEffect(() => {
    if (layer.current) layer.current.inert = !isOpen;
    if (!isOpen) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (pause.current?.disabled ? exit.current : pause.current)?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [isOpen]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") { event.preventDefault(); onExit(); }
    if (event.key !== "Tab") return;
    const buttons = Array.from(layer.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault(); (event.shiftKey ? last : first)?.focus();
    }
  };

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
    <section ref={layer} className="screensaver" data-open={isOpen} role="dialog" aria-modal={isOpen || undefined}
      aria-label="Timer screensaver" aria-hidden={!isOpen} onKeyDown={handleKeyDown}>
      <div className="screensaver-wallpaper" data-testid="screensaver-wallpaper" data-palette={theme.name}
        style={{ backgroundImage: `url("${theme.src}")`, filter: theme.filter }} aria-hidden="true" />
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
