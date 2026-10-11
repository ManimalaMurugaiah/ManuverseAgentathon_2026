import type { ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

function Icon({ children }: Readonly<{ children: ReactNode }>): JSX.Element {
  return (
    <svg className="side-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

const icons = {
  overview: (
    <Icon>
      <path d="M3.5 11 12 3.5 20.5 11" />
      <path d="M5.5 9.8V20h4.2v-5.6h4.6V20h4.2V9.8" />
    </Icon>
  ),
  projects: (
    <Icon>
      <path d="M4 7h16M4 12h10M4 17h16" />
    </Icon>
  ),
  milestones: (
    <Icon>
      <path d="M6 21V3.5" />
      <path d="M6 4.5h11.5L15 8.6l2.5 4.1H6" />
    </Icon>
  ),
  dependencies: (
    <Icon>
      <rect x="3.5" y="3.5" width="6" height="5.5" rx="1" />
      <rect x="14.5" y="3.5" width="6" height="5.5" rx="1" />
      <rect x="9" y="15" width="6" height="5.5" rx="1" />
      <path d="M6.5 9v3h11V9M12 12v3" />
    </Icon>
  ),
  risks: (
    <Icon>
      <path d="M12 3.5 21.5 20h-19z" />
      <path d="M12 10v5M12 17.6v.1" />
    </Icon>
  ),
  actions: (
    <Icon>
      <path d="m3.5 6.2 1.6 1.6 2.6-3M3.5 12.2l1.6 1.6 2.6-3M3.5 18.2l1.6 1.6 2.6-3" />
      <path d="M11 6.5h9.5M11 12.5h9.5M11 18.5h9.5" />
    </Icon>
  ),
  reports: (
    <Icon>
      <path d="M5 20v-6M10 20V8M15 20v-9M20 20V5" />
    </Icon>
  ),
  settings: (
    <Icon>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M5.6 18.4l1.7-1.7M16.7 7.3l1.7-1.7" />
    </Icon>
  ),
};

type NavKey = keyof typeof icons;

interface NavItem {
  key: NavKey;
  label: string;
  to?: string;
  end?: boolean;
}

// Items without a route stay visible to match the design but are not clickable yet.
const NAV_ITEMS: NavItem[] = [
  { key: "overview", label: "Overview", to: "/", end: true },
  { key: "projects", label: "Projects", to: "/projects" },
  { key: "milestones", label: "Milestones", to: "/milestones" },
  { key: "dependencies", label: "Dependencies" },
  { key: "risks", label: "Risks & Issues" },
  { key: "actions", label: "Actions" },
  { key: "reports", label: "Reports", to: "/analytics" },
  { key: "settings", label: "Settings" },
];

const PROJECT_MILESTONES = /^\/projects\/[^/]+\/milestones\/?$/;

function initialsOf(name: string | undefined): string {
  return (name ?? "").trim().slice(0, 2).toUpperCase() || "U";
}

function titleCase(value: string | undefined): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

export function Layout(): JSX.Element {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  // A project's milestone page belongs to Milestones, not Projects.
  const onProjectMilestones = PROJECT_MILESTONES.test(pathname);

  const isActive = (item: NavItem, routerActive: boolean): boolean => {
    if (item.key === "milestones") return routerActive || onProjectMilestones;
    if (item.key === "projects") return routerActive && !onProjectMilestones;
    return routerActive;
  };

  return (
    <div className="app-frame">
      <aside className="side-nav">
        <div className="side-brand">
          <span className="side-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M12 5.2V3.6" />
              <circle cx="12" cy="3.1" r="0.9" />
              <rect x="4" y="7" width="16" height="12" rx="3.2" />
              <path d="M9.2 12.2v.1M14.8 12.2v.1M9.8 15.4h4.4" />
            </svg>
          </span>
          <span className="side-brand-copy">
            <strong>AI Project Orchestrator</strong>
            <small>Smarter Projects. Faster Delivery.</small>
          </span>
        </div>

        <nav className="side-menu" aria-label="Main navigation">
          {NAV_ITEMS.map((item) =>
            item.to ? (
              <NavLink
                key={item.key}
                to={item.to}
                end={item.end}
                className={({ isActive: routerActive }) =>
                  `side-link${isActive(item, routerActive) ? " is-active" : ""}`
                }
              >
                {icons[item.key]}
                <span>{item.label}</span>
              </NavLink>
            ) : (
              <button key={item.key} type="button" className="side-link is-disabled" disabled title="Coming soon">
                {icons[item.key]}
                <span>{item.label}</span>
              </button>
            ),
          )}
        </nav>

        <div className="side-agents">
          <strong>AI agents</strong>
          <p>Agents execute tasks and ask for approval when required.</p>
        </div>

        <div className="side-profile">
          <span className="side-avatar" aria-hidden="true">
            {initialsOf(user?.username)}
          </span>
          <span className="side-profile-copy">
            <strong>{user?.username}</strong>
            <small>{titleCase(user?.role)}</small>
          </span>
          <button type="button" className="side-logout" onClick={() => void logout()} aria-label="Log out" title="Log out">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M9 4.5H5.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H9M15.5 8 20 12l-4.5 4M20 12H9.5" />
            </svg>
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
