import { Outlet } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import Sidebar from "./Sidebar";

const MainLayout = () => {
  const { user } = useAuth();

  return (
    <div className="app-layout">
      <Sidebar username={user?.username ?? ""} />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
