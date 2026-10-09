import { Link, Outlet } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export function Layout(): JSX.Element {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>AI Project Orchestrator</h1>
        <p className="muted">Smarter Projects. Faster Delivery.</p>
        <nav>
          <Link to="/">Overview</Link>
          <Link to="/workflow">Projects</Link>
          <Link to="/">Milestones</Link>
          <Link to="/">Dependencies</Link>
          <Link to="/">Risks and Issues</Link>
          <Link to="/">Actions</Link>
          <Link to="/analytics">Reports</Link>
          <Link to="/">Settings</Link>
          <Link to="/workflow">Workflow</Link>
        </nav>
        <div className="sidebar-footer">
          <p>{user?.username}</p>
          <p className="muted">Role: {user?.role}</p>
          <button onClick={() => void logout()}>Logout</button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
