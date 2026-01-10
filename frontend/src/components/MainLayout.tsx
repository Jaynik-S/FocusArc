import { Outlet } from "react-router-dom";

import { getUsername } from "../api/apiClient";
import Sidebar from "./Sidebar";

const MainLayout = () => {
  const username = getUsername();

  return (
    <div className="app-layout">
      <Sidebar username={username} />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
