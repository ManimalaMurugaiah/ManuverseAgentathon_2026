import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../api/client";
import { getApiErrorMessage } from "../api/errors";
import { useApiData } from "../api/useApiData";
import { useBusiness } from "../api/useBusiness";
import { Avatar, ErrorState, LoadingState, Notice, Pill, ProgressBar, canWriteProjects, scheduleTone, useDebounced } from "../components/ui";
import { ProjectWizard } from "../components/ProjectWizard";
import { useAuth } from "../context/AuthContext";
import type { Lookups, Project, ProjectDetail, ProjectList, ProjectSummary } from "../types";
import { formatMoney, percent } from "../utils/format";

const PAGE_SIZES = [10, 25, 50];
const BUDGET_BANDS: Record<string, { label: string; min?: number; max?: number }> = {
  lt10: { label: "Under $10M", max: 9_999_999 },
  "10to50": { label: "$10M – $50M", min: 10_000_000, max: 50_000_000 },
  gt50: { label: "Over $50M", min: 50_000_001 },
};
const EMPTY_LOOKUPS: Lookups = {
  project_types: [], lifecycle_statuses: ["Draft", "Planning", "Execution", "On Hold", "Completed", "Cancelled"], risk_levels: ["Low", "Medium", "High", "Critical"],
  action_statuses: [], owners: [], plants: [], countries: [], businesses: [], templates: [], roles: [],
};

const formatDate = (value: string | null): string =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

type WizardState = { project: ProjectDetail | null } | null;

export function ProjectsPage(): JSX.Element {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { business, withBusiness } = useBusiness();
  const canWrite = canWriteProjects(user?.role);

  const [search, setSearch] = useState("");
  const [schedule, setSchedule] = useState("");
  const [owner, setOwner] = useState("");
  const [plant, setPlant] = useState("");
  const [budget, setBudget] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [wizard, setWizard] = useState<WizardState>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"ok" | "error">("ok");
  const menuRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounced(search);

  const band = BUDGET_BANDS[budget];
  const params = {
    search: debouncedSearch.trim(), schedule_status: schedule, owner, plant, business,
    budget_min: band?.min, budget_max: band?.max, page, page_size: pageSize,
  };
  const list = useApiData<ProjectList>("/projects", params);
  const summary = useApiData<ProjectSummary>("/projects/summary", { business });
  const lookups = useApiData<Lookups>("/lookups");

  useEffect(() => {
    if (menuFor === null) return undefined;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent && menuRef.current?.contains(event.target as Node)) return;
      setMenuFor(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuFor]);

  const refresh = () => {
    list.reload();
    summary.reload();
    lookups.reload();
  };

  const tell = (message: string, tone: "ok" | "error" = "ok") => {
    setNotice(message);
    setNoticeTone(tone);
  };

  const changeFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  const openEdit = async (project: Project) => {
    setMenuFor(null);
    try {
      const { data } = await api.get<ProjectDetail>(`/projects/${project.id}`);
      setWizard({ project: data });
    } catch (error) {
      tell(getApiErrorMessage(error, "Could not open this project for editing."), "error");
    }
  };

  const toggleAgents = async (project: Project) => {
    setMenuFor(null);
    try {
      await api.patch(`/projects/${project.id}`, { ai_agents_enabled: !project.ai_agents_enabled });
      tell(`AI agents ${project.ai_agents_enabled ? "turned off" : "enabled"} for ${project.name}.`);
      refresh();
    } catch (error) {
      tell(getApiErrorMessage(error, "Could not change the AI agent setting."), "error");
    }
  };

  const data = list.data;
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(page * pageSize, total);
  const counts = summary.data;
  const filtersActive = Boolean(debouncedSearch.trim() || schedule || owner || plant || budget);

  const cards = [
    { key: "total", label: "Total Projects", value: counts?.total ?? 0, tone: "blue", icon: "▤" },
    { key: "on", label: "On Track", value: counts?.on_track ?? 0, tone: "green", icon: "✓" },
    { key: "risk", label: "At Risk", value: counts?.at_risk ?? 0, tone: "amber", icon: "△" },
    { key: "late", label: "Delayed", value: counts?.delayed ?? 0, tone: "red", icon: "◷" },
    { key: "done", label: "Completed", value: counts?.completed ?? 0, tone: "violet", icon: "★" },
  ];

  return (
    <section className="pl-page">
      <header className="pl-heading">
        <div>
          <h1>Projects</h1>
          <p>Manage all projects across the organization{business ? ` · ${business}` : ""}</p>
        </div>
        {canWrite ? (
          <button type="button" className="pl-primary" disabled={!lookups.data} onClick={() => setWizard({ project: null })}>＋ Create Project</button>
        ) : null}
      </header>

      <Notice message={notice} tone={noticeTone} />
      {lookups.error ? <Notice message={`Project form options could not be loaded. ${lookups.error}`} tone="error" /> : null}

      <div className="pl-kpis" aria-label="Project summary">
        {cards.map((card) => (
          <article className="pl-kpi" key={card.key}>
            <span className={`pl-kpi-icon pl-tone-${card.tone}`} aria-hidden="true">{card.icon}</span>
            <span className="pl-kpi-copy">
              <small>{card.label}</small>
              <strong>{summary.loading && !counts ? "–" : card.value}</strong>
            </span>
            {card.key === "total" ? null : <span className={`pl-kpi-pct pl-text-${card.tone}`}>{percent(card.value, counts?.total ?? 0)}%</span>}
          </article>
        ))}
      </div>

      <section className="pl-card" aria-label="Project register">
        <div className="pl-toolbar">
          <label className="pl-search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Search projects"
              placeholder="Search projects by name, owner or ID..."
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            />
            {search ? <button type="button" aria-label="Clear project search" onClick={() => { setSearch(""); setPage(1); }}>×</button> : null}
          </label>
          <select aria-label="Filter by status" value={schedule} onChange={(event) => changeFilter(setSchedule)(event.target.value)}>
            <option value="">All Status</option>
            {["On track", "At risk", "Delayed", "Completed"].map((option) => <option key={option}>{option}</option>)}
          </select>
          <select aria-label="Filter by owner" value={owner} onChange={(event) => changeFilter(setOwner)(event.target.value)}>
            <option value="">All Owners</option>
            {(data?.owners ?? []).map((name) => <option key={name}>{name}</option>)}
          </select>
          <select aria-label="Filter by plant" value={plant} onChange={(event) => changeFilter(setPlant)(event.target.value)}>
            <option value="">All Plants</option>
            {(data?.plants ?? []).map((name) => <option key={name}>{name}</option>)}
          </select>
          <select aria-label="Filter by budget" value={budget} onChange={(event) => changeFilter(setBudget)(event.target.value)}>
            <option value="">All Budgets</option>
            {Object.entries(BUDGET_BANDS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select>
          {filtersActive ? (
            <button type="button" className="pl-link" onClick={() => { setSearch(""); setSchedule(""); setOwner(""); setPlant(""); setBudget(""); setPage(1); }}>Clear filters</button>
          ) : null}
        </div>

        {list.error && !data ? <ErrorState message={list.error} onRetry={list.reload} /> : null}
        {list.loading && !data ? <LoadingState label="Loading projects…" /> : null}

        {data ? (
          <div className="pl-scroll">
            <table className="pl-table">
              <thead>
                <tr>
                  <th>#</th><th>Project Name</th><th>Project ID</th><th>Plant / Location</th><th>Owner</th>
                  <th>Start Date</th><th>End Date</th><th>Budget (USD)</th><th>Progress</th><th>Status</th><th>Health</th>
                  <th><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((project, index) => (
                  <tr key={project.id} onClick={() => navigate(withBusiness(`/projects/${project.id}`))}>
                    <td className="pl-muted">{(page - 1) * pageSize + index + 1}</td>
                    <td>
                      <Link className="pl-name" to={withBusiness(`/projects/${project.id}`)} onClick={(event) => event.stopPropagation()}>
                        <span className={`pl-initial pl-avatar--${project.id % 6}`} aria-hidden="true">{project.name.charAt(0).toUpperCase()}</span>
                        <strong>{project.name}</strong>
                      </Link>
                    </td>
                    <td>{project.code ?? "—"}</td>
                    <td>{project.location ?? "—"}</td>
                    <td><span className="pl-owner"><Avatar name={project.owner} />{project.owner ?? "—"}</span></td>
                    <td>{formatDate(project.start_date)}</td>
                    <td>{formatDate(project.end_date)}</td>
                    <td>{formatMoney(project.budget)}</td>
                    <td><ProgressBar value={project.progress} tone={scheduleTone(project.schedule_status)} /></td>
                    <td><Pill value={project.schedule_status} /></td>
                    <td><Pill value={project.health} kind="health" /></td>
                    <td className="pl-actions" onClick={(event) => event.stopPropagation()}>
                      <div ref={menuFor === project.id ? menuRef : undefined} className="pl-menu-wrap">
                        <button
                          type="button"
                          className="pl-menu-button"
                          aria-label={`Actions for ${project.name}`}
                          aria-haspopup="menu"
                          aria-expanded={menuFor === project.id}
                          onClick={() => setMenuFor(menuFor === project.id ? null : project.id)}
                        >
                          ⋯
                        </button>
                        {menuFor === project.id ? (
                          <div className="pl-menu" role="menu">
                            <button type="button" role="menuitem" onClick={() => navigate(withBusiness(`/projects/${project.id}`))}>View details</button>
                            {canWrite ? <button type="button" role="menuitem" onClick={() => void openEdit(project)}>Edit project</button> : null}
                            <button type="button" role="menuitem" onClick={() => navigate(withBusiness(`/projects/${project.id}/milestones`))}>Open milestones</button>
                            {canWrite ? (
                              <button type="button" role="menuitem" onClick={() => void toggleAgents(project)}>
                                {project.ai_agents_enabled ? "Turn AI agents off" : "Enable AI agents"}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {!data.items.length ? (
                  <tr>
                    <td colSpan={12} className="pl-empty">
                      {filtersActive ? "No projects match these filters." : canWrite ? "No projects yet. Use Create Project to add the first one." : "No projects yet."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}

        <footer className="pl-footer">
          <span>Showing {rangeStart}–{rangeEnd} of {total} projects</span>
          <nav className="pl-pages" aria-label="Project pages">
            <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>‹</button>
            {Array.from({ length: pageCount }, (_, index) => index + 1)
              .filter((number) => number === 1 || number === pageCount || Math.abs(number - page) <= 1)
              .map((number) => (
                <button key={number} type="button" aria-label={`Page ${number}`} aria-current={number === page ? "page" : undefined} className={number === page ? "is-current" : ""} onClick={() => setPage(number)}>{number}</button>
              ))}
            <button type="button" aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>›</button>
          </nav>
          <label className="pl-size">
            <span className="visually-hidden">Projects per page</span>
            <select aria-label="Projects per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
              {PAGE_SIZES.map((size) => <option key={size} value={size}>{size} / page</option>)}
            </select>
          </label>
        </footer>
      </section>

      {wizard ? (
        <ProjectWizard
          project={wizard.project}
          lookups={lookups.data ?? EMPTY_LOOKUPS}
          defaultOwner={user?.username ?? ""}
          onClose={() => setWizard(null)}
          onSaved={(saved) => {
            setWizard(null);
            tell(wizard.project ? `${saved.name} was updated.` : `${saved.name} was created.`);
            setPage(1);
            refresh();
          }}
        />
      ) : null}
    </section>
  );
}
