import { NavLink } from "react-router-dom";

const PrimaryNav = () => {
  return (
    <nav className="primary-nav">
      <NavLink
        className={({ isActive }) =>
          `nav-pill${isActive ? " nav-pill-active" : ""}`
        }
        to="/timers"
        title="Timers"
      >
        Timers
      </NavLink>
      <NavLink
        className={({ isActive }) =>
          `nav-pill${isActive ? " nav-pill-active" : ""}`
        }
        to="/schedule"
        title="Schedule"
      >
        Schedule
      </NavLink>
      <NavLink
        className={({ isActive }) =>
          `nav-pill${isActive ? " nav-pill-active" : ""}`
        }
        to="/history"
        title="History"
      >
        History
      </NavLink>
    </nav>
  );
};

export default PrimaryNav;
