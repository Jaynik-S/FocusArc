import { Navigate, Route, Routes } from "react-router-dom";

import { getUsername, AuthenticationError } from "./api/apiClient";
import MainLayout from "./components/MainLayout";
import { LockScreen } from "./components/LockScreen";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { TimerRuntimeProvider } from "./context/TimerRuntimeContext";
import { TimerSelectionProvider } from "./context/TimerSelectionContext";
import HistoryPage from "./routes/HistoryPage";
import SchedulePage from "./routes/SchedulePage";
import StatsPage from "./routes/StatsPage";
import TimersPage from "./routes/TimersPage";
import UsernameGate from "./routes/UsernameGate";

const RequireUsername = ({ children }: { children: React.ReactNode }) => {
  const hasUsername = Boolean(getUsername());
  if (!hasUsername) {
    return <Navigate to="/" replace />;
  }
  return children;
};

const AppRoutes = () => {
  const { locked } = useAuth();

  if (locked) {
    return <LockScreen />;
  }

  return (
    <TimerRuntimeProvider>
      <TimerSelectionProvider>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<UsernameGate />} />
            <Route
              path="/timers"
              element={
                <RequireUsername>
                  <TimersPage />
                </RequireUsername>
              }
            />
            <Route
              path="/schedule"
              element={
                <RequireUsername>
                  <SchedulePage />
                </RequireUsername>
              }
            />
            <Route
              path="/history"
              element={
                <RequireUsername>
                  <HistoryPage />
                </RequireUsername>
              }
            />
            <Route
              path="/stats"
              element={
                <RequireUsername>
                  <StatsPage />
                </RequireUsername>
              }
            />
            <Route path="*" element={<Navigate to="/timers" replace />} />
          </Route>
        </Routes>
      </TimerSelectionProvider>
    </TimerRuntimeProvider>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
};

export default App;
