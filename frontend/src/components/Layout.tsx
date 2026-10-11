import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from "react-router-dom";

import { useApiData } from "../api/useApiData";
import { useAuth } from "../context/AuthContext";
import type { Lookups, RiskList } from "../types";

const navigation = [
  { label: "Overview", to: "/", icon: "⌂", end: true },
  { label: "Projects", to: "/projects", icon: "▣", end: false },
  { label: "Milestones", to: "/milestones", icon: "⚑", end: false },
  { label: "Dependencies", to: "/dependencies", icon: "⑂", end: false },
  { label: "Risks & Issues", to: "/risks", icon: "⚠", end: false },
  { label: "Actions", to: "/actions", icon: "✓", end: false },
  { label: "Reports", to: "/reports", icon: "▤", end: false },
];

export function Layout(): JSX.Element {
  const { user, logout } = useAuth();
  const initials = user?.username.slice(0, 2).toUpperCase() ?? "SP";
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestedBusiness = searchParams.get("business") ?? "";
  const lookups = useApiData<Lookups>("/lookups");
  const businesses = lookups.data?.businesses ?? [];
  // Keep a business from the URL selectable even if lookups have not loaded or it has no projects yet.
  const selectedBusiness = requestedBusiness;
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const risksData = useApiData<RiskList>("/risks", { business: selectedBusiness, active_only: true, limit: 50 });
  const notifications = risksData.data?.items ?? [];

  useEffect(() => {
    if (!notificationsOpen && !userMenuOpen) return undefined;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!notificationRef.current?.contains(event.target)) {
        setNotificationsOpen(false);
      }
      if (!userMenuRef.current?.contains(event.target)) setUserMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [notificationsOpen, userMenuOpen]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link
          to={{ pathname: "/", search: searchParams.toString() ? `?${searchParams.toString()}` : "" }}
          className="brand-lockup"
          aria-label="AI Project Orchestrator overview"
        >
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" role="presentation">
              <path d="M24 7c-8.3 0-15 6.7-15 15 0 7.1 4.8 13 11.3 14.4l.2 4.6h7l.2-4.6C34.2 35 39 29.1 39 22c0-8.3-6.7-15-15-15Z" />
              <circle cx="19" cy="22" r="2.1" />
              <circle cx="29" cy="22" r="2.1" />
              <path d="M19 29c1.4 2 3.3 3 5 3s3.6-1 5-3" />
            </svg>
          </span>
          <span className="brand-copy">
            <strong>AI Project Orchestrator</strong>
            <small>Detect • Predict • Act • Deliver</small>
          </span>
        </Link>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <NavLink
              key={item.label}
              to={{ pathname: item.to, search: searchParams.toString() ? `?${searchParams.toString()}` : "" }}
              end={item.end}
              className={({ isActive }) => `sidebar-nav-link${isActive ? " is-active" : ""}`}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {item.end ? <span className="nav-active-indicator" aria-hidden="true" /> : null}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-assistant">
          <span className="assistant-sparkle" aria-hidden="true">✦</span>
          <strong>Smarter Projects.<br />Faster Delivery.</strong>
        </div>

        <div className="sidebar-profile">
          <span className="profile-avatar">{initials}</span>
          <span className="profile-copy">
            <strong>{user?.username ?? "Account"}</strong>
            <small>{user?.role ?? "Workspace user"}</small>
          </span>
          <button className="logout-button" onClick={logout} aria-label="Log out" title="Log out">
            ↗
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-context">
            <label className="topbar-label" htmlFor="business-select">Business</label>
            <select
              id="business-select"
              className="project-select"
              aria-label="Select business"
              value={selectedBusiness}
              onChange={(event) => {
                const nextParams = new URLSearchParams(searchParams);
                if (event.target.value) nextParams.set("business", event.target.value);
                else nextParams.delete("business");
                setSearchParams(nextParams, { replace: true });
              }}
            >
              <option value="">All businesses</option>
              {selectedBusiness && !businesses.includes(selectedBusiness) ? <option value={selectedBusiness}>{selectedBusiness}</option> : null}
              {businesses.map((business) => <option key={business} value={business}>{business}</option>)}
            </select>
          </div>

          <div className="topbar-account">
            <div className="notification-wrap" ref={notificationRef}>
              <button
              type="button"
              className="topbar-icon"
              aria-label={`Notifications, ${notifications.length} active`}
              aria-expanded={notificationsOpen}
              aria-controls="notification-panel"
              onClick={() => setNotificationsOpen((open) => !open)}
              >
              🔔
              {notifications.length ? <span className="notification-count">{notifications.length}</span> : null}
              </button>
              {notificationsOpen ? (
              <section className="notification-panel" id="notification-panel" aria-label="Notifications">
                <div className="notification-heading">
                  <strong>{selectedBusiness || "All businesses"}</strong>
                  <span>{notifications.length} active</span>
                </div>
                {notifications.slice(0, 4).map((risk) => (
                  <button
                    className="notification-item"
                    key={risk.id}
                    type="button"
                    onClick={() => {
                      const nextParams = new URLSearchParams(searchParams);
                      if (risk.business) nextParams.set("business", risk.business);
                      setNotificationsOpen(false);
                      navigate({ pathname: "/risks", search: nextParams.toString() ? `?${nextParams.toString()}` : "" });
                    }}
                  >
                    <span className={`severity-indicator severity-${risk.severity.toLowerCase()}`} aria-hidden="true" />
                    <span><strong>{risk.title}</strong><small>{risk.project_name ?? risk.business ?? ""} · {risk.severity}</small></span>
                  </button>
                ))}
                {!notifications.length ? <p className="notification-empty">No active issues{selectedBusiness ? " for this business" : ""}.</p> : null}
                <button
                  className="notification-view-all"
                  type="button"
                  onClick={() => {
                    setNotificationsOpen(false);
                    navigate({ pathname: "/risks", search: searchParams.toString() ? `?${searchParams.toString()}` : "" });
                  }}
                >
                  View risks &amp; issues
                </button>
              </section>
              ) : null}
            </div>
            <div className="user-menu-wrap" ref={userMenuRef}>
              <button
                type="button"
                className="topbar-user-trigger"
                aria-label="Open user menu"
                aria-expanded={userMenuOpen}
                aria-controls="user-menu"
                onClick={() => setUserMenuOpen((open) => !open)}
              >
                <span className="topbar-avatar">{initials}</span>
                <span className="topbar-user"><strong>{user?.username}</strong></span>
                <span className="topbar-caret" aria-hidden="true">▾</span>
              </button>
              {userMenuOpen ? (
                <div className="user-menu" id="user-menu" role="menu">
                  <div className="user-menu-identity">
                    <strong>{user?.username}</strong>
                    <small>{user?.role}</small>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate({ pathname: "/settings", search: searchParams.toString() ? `?${searchParams.toString()}` : "" });
                    }}
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                  >
                    Log out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="main-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
