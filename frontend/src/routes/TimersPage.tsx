import { useMemo } from "react";

import { getUsername } from "../api/apiClient";
import TopBar from "../components/TopBar";

const TimersPage = () => {
  const username = useMemo(() => getUsername(), []);

  return (
    <div className="page">
      <TopBar username={username} />
      <div className="card">
        <div className="card-header">
          <h2>Today</h2>
          <p>Timers will appear here once created.</p>
        </div>
        <div className="card-body">
          <button className="secondary" type="button">
            Create a timer
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimersPage;
