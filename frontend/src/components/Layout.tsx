import { Link, Outlet } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export function Layout(): JSX.Element {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Manuverse</h1>
        <p className="muted">AI Project Orchestrator</p>
        <nav>
          <Link to="/">Dashboard</Link>
          <Link to="/workflow">Workflow</Link>
          <Link to="/analytics">Analytics</Link>
        </nav>
        <div className="sidebar-footer">
          <p>{user?.username}</p>
          <p className="muted">Role: {user?.role}</p>
          <button onClick={logout}>Logout</button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
