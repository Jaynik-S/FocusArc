import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";

import { useTimerRuntime } from "../context/TimerRuntimeContext";
import { useSelectedTimer } from "../context/TimerSelectionContext";
import { useAuth } from "../contexts/AuthContext";
import { useScreensaverMode } from "../hooks/useScreensaverMode";
import { useScreensaverWallpaper } from "../hooks/useScreensaverWallpaper";
import Screensaver from "./Screensaver";
import Sidebar from "./Sidebar";
import { getContrastColor, isValidHexColor } from "../utils/color";

const MainLayout = () => {
  const { user } = useAuth();
  const { activeSession, snapshotTimers, elapsedByTimer, elapsedSeconds } = useTimerRuntime();
  const { selectedTimerId } = useSelectedTimer();
  const { isOpen, exit } = useScreensaverMode(activeSession?.id ?? null);
  const wallpaper = useScreensaverWallpaper(user?.username ?? "", activeSession);
  const [screensaverVisible, setScreensaverVisible] = useState(false);
  const normalView = useRef<HTMLDivElement>(null);
  const timerId = activeSession?.timer_id ?? selectedTimerId;
  const timer = snapshotTimers.find((item) => item.id === timerId) ?? null;
  const accentTimer = snapshotTimers.find((item) => item.id === selectedTimerId) ?? timer;
  const accentStyle = accentTimer && isValidHexColor(accentTimer.color) ? {
    "--app-accent": accentTimer.color,
    "--app-accent-contrast": getContrastColor(accentTimer.color),
  } as CSSProperties : undefined;
  const displaySeconds = (timerId ? elapsedByTimer[timerId] ?? 0 : 0) + (activeSession ? elapsedSeconds : 0);

  useLayoutEffect(() => {
    if (normalView.current) normalView.current.inert = screensaverVisible;
  }, [screensaverVisible]);

  return (
    <>
      <div className="app-layout" style={accentStyle} ref={normalView} aria-hidden={screensaverVisible || undefined}>
        <Sidebar username={user?.username ?? ""} />
        <main className="main-content" id="main-content">
          <Outlet />
        </main>
      </div>
      <Screensaver isOpen={isOpen && wallpaper.activationId === activeSession?.id} onExit={exit} timer={timer} elapsedSeconds={displaySeconds} wallpaper={wallpaper} onVisibleChange={setScreensaverVisible} />
    </>
  );
};

export default MainLayout;
