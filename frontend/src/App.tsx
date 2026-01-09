import { Navigate, Route, Routes } from "react-router-dom";

import { getUsername } from "./api/apiClient";
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
      </Routes>
    </div>
  );
};

export default App;
