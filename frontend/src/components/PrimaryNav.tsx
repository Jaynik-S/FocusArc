import { NavLink } from "react-router-dom";
import SoftFrame from "./SoftFrame";

const PrimaryNav = () => {
  return (
    <nav className="primary-nav" aria-label="Primary navigation">
      <NavLink
        className={({ isActive }) =>
          `nav-pill${isActive ? " nav-pill-active" : ""}`
        }
        to="/timers"
        title="Timers"
      >
        <SoftFrame />
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5M9 2h6M12 2v3" /></svg>
        <span>Timers</span>
      </NavLink>
      <NavLink
        className={({ isActive }) =>
          `nav-pill${isActive ? " nav-pill-active" : ""}`
        }
        to="/schedule"
        title="Schedule"
      >
        <SoftFrame />
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="4" /><path d="M8 3v4m8-4v4M4 11h16m-11 4h.01M13 15h.01" /></svg>
        <span>Schedule</span>
      </NavLink>
      <NavLink
        className={({ isActive }) =>
          `nav-pill${isActive ? " nav-pill-active" : ""}`
        }
        to="/history"
        title="History"
      >
        <SoftFrame />
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 8M4 5v5h5m3-2v5l3 2" /></svg>
        <span>History</span>
      </NavLink>
      <NavLink
        className={({ isActive }) =>
          `nav-pill${isActive ? " nav-pill-active" : ""}`
        }
        to="/stats"
        title="Stats"
      >
        <SoftFrame />
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V11m7 9V5m7 15v-7M3 20h18" /></svg>
        <span>Stats</span>
      </NavLink>
    </nav>
  );
};

export default PrimaryNav;
