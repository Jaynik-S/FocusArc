import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AuthScreen } from "./components/AuthScreen";
import MainLayout from "./components/MainLayout";
import { TimerRuntimeProvider, useTimerRuntimeState } from "./context/TimerRuntimeContext";
import { TimerSelectionProvider } from "./context/TimerSelectionContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import HistoryPage from "./routes/HistoryPage";
import SchedulePage from "./routes/SchedulePage";
import StatsPage from "./routes/StatsPage";
import TimersPage from "./routes/TimersPage";
import { migrateLegacyAccountStorage } from "./storage/accountStorage";

const StudyReady = ({ children }: { children: React.ReactNode }) => {
  const { revision, error, refresh } = useTimerRuntimeState();
  if (revision === null) return <main className="auth-page">
    <p role="status">Loading shared study data…</p>
    {error ? <div className="error" role="alert">{error} <button className="link-button" onClick={() => void refresh().catch(() => {})}>Retry sync</button></div> : null}
  </main>;
  return <>{children}</>;
};

const AuthenticatedApp = ({ username }: { username: string }) => {
  const [storageReady] = useState(() => {
    migrateLegacyAccountStorage(username);
    return true;
  });
  if (!storageReady) return null;
  return (
    <TimerRuntimeProvider username={username}>
      <StudyReady>
      <TimerSelectionProvider username={username}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Navigate to="/timers" replace />} />
            <Route path="/timers" element={<TimersPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="*" element={<Navigate to="/timers" replace />} />
          </Route>
        </Routes>
      </TimerSelectionProvider>
      </StudyReady>
    </TimerRuntimeProvider>
  );
};

const AppRoutes = () => {
  const { status, user } = useAuth();
  if (status === "checking") return <main className="auth-page"><p>Checking session…</p></main>;
  if (status === "anonymous" || !user) return <AuthScreen />;
  return <AuthenticatedApp key={user.username} username={user.username} />;
};

const App = () => <AuthProvider><AppRoutes /></AuthProvider>;

export default App;
