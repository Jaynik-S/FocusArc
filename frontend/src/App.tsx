import { Navigate, Route, Routes } from "react-router-dom";

import { getUsername } from "./api/apiClient";
import HistoryPage from "./routes/HistoryPage";
import SchedulePage from "./routes/SchedulePage";
import StatsPage from "./routes/StatsPage";
import TimersPage from "./routes/TimersPage";
import UsernameGate from "./routes/UsernameGate";

const App = () => {
  const hasUsername = Boolean(getUsername());

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<UsernameGate />} />
        <Route
          path="/timers"
          element={hasUsername ? <TimersPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/schedule"
          element={hasUsername ? <SchedulePage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/history"
          element={hasUsername ? <HistoryPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/stats"
          element={hasUsername ? <StatsPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="*"
          element={<Navigate to={hasUsername ? "/timers" : "/"} replace />}
        />
      </Routes>
    </div>
  );
};

export default App;
