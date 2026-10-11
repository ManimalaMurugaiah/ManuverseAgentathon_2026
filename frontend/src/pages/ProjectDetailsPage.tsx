import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useApiData } from "../api/useApiData";
import { useBusiness } from "../api/useBusiness";
import { ErrorState, LoadingState, Notice, Pill, ProgressBar, canWriteProjects, scheduleTone } from "../components/ui";
import { ProjectWizard } from "../components/ProjectWizard";
import { useAuth } from "../context/AuthContext";
import type { Lookups, ProjectDetail } from "../types";
import { formatMoney, percent } from "../utils/format";

const formatDate = (value: string | null): string =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function ProjectDetailsPage(): JSX.Element {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { withBusiness } = useBusiness();
  const canWrite = canWriteProjects(user?.role);
  const project = useApiData<ProjectDetail>(projectId ? `/projects/${projectId}` : null);
  const lookups = useApiData<Lookups>(canWrite ? "/lookups" : null);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");

  if (project.loading && !project.data) return <section className="pl-page"><LoadingState label="Loading project…" /></section>;
  if (!project.data) {
    return (
      <section className="pl-page">
        <ErrorState message={project.error || "Project not found."} onRetry={project.reload} />
        <Link className="pl-link" to={withBusiness("/projects")}>← Back to projects</Link>
      </section>
    );
  }

  const data = project.data;
  const m = data.metrics;
  const total = m.milestones_total;
  const inProgress = m.milestones_in_progress + m.milestones_at_risk;
  const donut = {
    completed: percent(m.milestones_completed, total),
    progress: percent(inProgress, total),
    notStarted: percent(m.milestones_not_started, total),
    delayed: percent(m.milestones_delayed, total),
  };
  const stops = [
    ["#149f69", donut.completed],
    ["#3477f6", donut.progress],
    ["#cbd6e8", donut.notStarted],
    ["#e9474c", donut.delayed],
  ] as const;
  let cursor = 0;
  const gradient = total
    ? `conic-gradient(${stops.map(([color, share]) => { const from = cursor; cursor += share; return `${color} ${from}% ${cursor}%`; }).join(", ")})`
    : "conic-gradient(#e8edf5 0 100%)";
  const onTrackMilestones = Math.max(0, total - m.milestones_at_risk - m.milestones_delayed);
  const openRisks = m.risks_high + m.risks_medium + m.risks_low;
  const weeks = data.duration_days === null ? null : Math.max(1, Math.round(data.duration_days / 7));
  const link = (path: string) => withBusiness(`${path}${path.includes("?") ? "&" : "?"}project_id=${data.id}`);

  const infoRows: [string, React.ReactNode][] = [
    ["Project Name", data.name],
    ["Project ID", data.code ?? "—"],
    ["Project Type", data.project_type ?? "—"],
    ["Plant / Location", data.location ?? "—"],
    ["Description", data.description ?? "—"],
    ["Business Objective", data.business_objective ?? "—"],
    ["Status", data.status ?? "—"],
    ["Health", <Pill key="health" value={data.health} kind="health" />],
    ["Project Manager", data.owner ?? "—"],
    ["Start Date", formatDate(data.start_date)],
    ["End Date", formatDate(data.end_date)],
    ["Duration", data.duration_days === null ? "—" : `${data.duration_days} days (${weeks} weeks)`],
  ];

  return (
    <section className="pl-page">
      <header className="pl-heading">
        <div>
          <Link className="pl-link" to={withBusiness("/projects")}>← Projects</Link>
          <h1>Project Details <Pill value={data.schedule_status} /></h1>
        </div>
        <div className="pl-heading-actions">
          {canWrite ? <button type="button" className="pl-primary" disabled={!lookups.data} onClick={() => setEditing(true)}>✎ Edit</button> : null}
          <div className="pl-menu-wrap">
            <button type="button" className="pl-secondary" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>More Actions ⌄</button>
            {menuOpen ? (
              <div className="pl-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => navigate(withBusiness(`/projects/${data.id}/milestones`))}>Milestones</button>
                <button type="button" role="menuitem" onClick={() => navigate(link("/dependencies"))}>Dependencies</button>
                <button type="button" role="menuitem" onClick={() => navigate(link("/risks"))}>Risks &amp; issues</button>
                <button type="button" role="menuitem" onClick={() => navigate(link("/actions"))}>Actions</button>
                <button type="button" role="menuitem" onClick={() => navigate(link("/reports"))}>Reports</button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <Notice message={notice} />

      <div className="pl-identity">
        <span className="pl-initial pl-initial--large pl-avatar--0" aria-hidden="true">{data.name.charAt(0).toUpperCase()}</span>
        <span><strong>{data.name}</strong><small>{[data.code, data.project_type].filter(Boolean).join(" · ")}</small></span>
      </div>

      <nav className="pl-tabs" aria-label="Project sections">
        <span className="is-current" aria-current="page">Overview</span>
        <Link to={withBusiness(`/projects/${data.id}/milestones`)}>Milestones</Link>
        <Link to={link("/dependencies")}>Dependencies</Link>
        <Link to={link("/risks")}>Risks &amp; Issues</Link>
        <Link to={link("/actions")}>Actions</Link>
      </nav>

      <div className="pl-detail-grid">
        <section className="pl-card pl-info" aria-label="Project information">
          <h2>Project Information</h2>
          <dl>
            {infoRows.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
        </section>

        <div className="pl-detail-side">
          <section className="pl-card" aria-label="Progress and timeline">
            <h2>Progress &amp; Timeline</h2>
            <div className="pl-progress-panel">
              <div className="pl-donut" style={{ background: gradient }} role="img" aria-label={`${data.progress} percent complete`}>
                <div><strong>{data.progress}%</strong><small>Complete</small></div>
              </div>
              <ul className="pl-legend">
                <li><i className="pl-dot pl-dot--green" />Completed<strong>{donut.completed}%</strong></li>
                <li><i className="pl-dot pl-dot--blue" />In Progress<strong>{donut.progress}%</strong></li>
                <li><i className="pl-dot pl-dot--grey" />Not Started<strong>{donut.notStarted}%</strong></li>
                <li><i className="pl-dot pl-dot--red" />Delayed<strong>{donut.delayed}%</strong></li>
              </ul>
            </div>
          </section>

          <section className="pl-card" aria-label="Key metrics">
            <h2>Key Metrics</h2>
            <div className="pl-metrics">
              <article>
                <small>Budget (USD)</small>
                <strong>{formatMoney(data.budget)}</strong>
                <ProgressBar value={m.budget_spent_pct} tone={m.budget_spent_pct >= 90 ? "red" : "blue"} />
                <span className="pl-muted">{formatMoney(data.budget_spent)} ({m.budget_spent_pct}%) spent</span>
              </article>
              <article>
                <small>Total Milestones</small>
                <strong>{total}</strong>
                <span className="pl-muted">{onTrackMilestones} On Track · {m.milestones_at_risk} At Risk · {m.milestones_delayed} Delayed</span>
              </article>
              <article>
                <small>Open Risks</small>
                <strong>{openRisks}</strong>
                <span className="pl-muted">{m.risks_high} High · {m.risks_medium} Medium · {m.risks_low} Low</span>
              </article>
              <article>
                <small>Open Actions</small>
                <strong>{m.actions_open}</strong>
                <span className="pl-muted">{m.actions_overdue} Overdue · {m.actions_due_soon} Due soon</span>
              </article>
            </div>
          </section>
        </div>
      </div>

      {editing && lookups.data ? (
        <ProjectWizard
          project={data}
          lookups={lookups.data}
          defaultOwner={user?.username ?? ""}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            setNotice(`${saved.name} was updated.`);
            project.reload();
          }}
        />
      ) : null}
    </section>
  );
}
