import { useNavigate } from "react-router-dom";

import { useApiData } from "../api/useApiData";
import { useBusiness } from "../api/useBusiness";
import { ErrorState, LoadingState } from "../components/ui";
import type { OverviewData } from "../types";
import { formatRelative } from "../utils/format";

const CHART_LEFT = 46;
const CHART_STEP = 99;

function ProjectHealthChart({ trend }: Readonly<{ trend: OverviewData["trend"] }>): JSX.Element {
  const known = trend
    .map((point, index) => ({ ...point, x: CHART_LEFT + index * CHART_STEP }))
    .filter((point): point is typeof point & { value: number } => point.value !== null)
    .map((point) => ({ ...point, y: 174 - point.value * 1.35 }));
  const line = known.map((point) => `${point.x},${point.y}`).join(" ");
  const area = known.length > 1 ? `${known[0].x},184 ${line} ${known[known.length - 1].x},184` : "";

  return (
    <svg className="overview-chart" viewBox="0 0 560 220" role="img" aria-label="Share of milestones completed by due month, last six months">
      {[40, 80, 120, 160].map((y, index) => (
        <g key={y}>
          <line x1="42" y1={y} x2="548" y2={y} className="overview-chart-grid" />
          <text x="4" y={y + 4} className="overview-chart-axis">{100 - index * 25}</text>
        </g>
      ))}
      {area ? <polygon points={area} className="overview-chart-area" /> : null}
      {known.length > 1 ? <polyline points={line} className="overview-chart-line" /> : null}
      {known.map((point) => <circle key={point.label} cx={point.x} cy={point.y} r="5" className="overview-chart-point" />)}
      {trend.map((point, index) => (
        <text key={`${point.label}-${index}`} x={CHART_LEFT + index * CHART_STEP} y="207" textAnchor="middle" className="overview-chart-axis">{point.label}</text>
      ))}
      {!known.length ? <text x="300" y="110" textAnchor="middle" className="overview-chart-axis">No milestones due in this period</text> : null}
    </svg>
  );
}

export function DashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const { business, withBusiness } = useBusiness();
  const overview = useApiData<OverviewData>("/dashboard/overview", { business });
  const go = (path: string) => navigate(withBusiness(path));

  if (overview.loading && !overview.data) {
    return <section className="overview-page"><LoadingState label="Loading overview…" /></section>;
  }
  if (!overview.data) {
    return <section className="overview-page"><ErrorState message={overview.error || "Could not load the overview."} onRetry={overview.reload} /></section>;
  }

  const { summary, milestones, trend, top_risks: risks, activity, priority_actions: actions } = overview.data;
  const { completed, in_progress: inProgress, upcoming, delayed } = milestones;
  const totalMilestones = completed + inProgress + upcoming + delayed;
  const share = (value: number) => (totalMilestones ? (value / totalMilestones) * 100 : 0);
  const stop = (from: number, to: number) => `${from}% ${to}%`;
  const a = share(completed);
  const b = a + share(inProgress);
  const c = b + share(upcoming);
  const ringBackground = totalMilestones
    ? `conic-gradient(#149f69 ${stop(0, a)}, #3477f6 ${stop(a, b)}, #cbd6e8 ${stop(b, c)}, #e9474c ${stop(c, 100)})`
    : "conic-gradient(#e8edf5 0 100%)";
  const linkFor = { risks: "/risks", actions: "/actions", milestones: "/milestones" } as const;

  return (
    <section className="overview-page">
      <header className="overview-heading">
        <div>
          <h1>Project Overview</h1>
          <p>Executive dashboard with real-time project health{business ? ` · ${business}` : ""}</p>
        </div>
      </header>
      {overview.error ? <ErrorState message={overview.error} onRetry={overview.reload} /> : null}

      <div className="overview-metrics">
        {[
          { label: "Total projects", value: summary.total, tone: "blue", icon: "☰" },
          { label: "On track", value: summary.on_track, tone: "green", icon: "✓" },
          { label: "At risk", value: summary.at_risk, tone: "amber", icon: "⚠" },
          { label: "Delayed", value: summary.delayed, tone: "red", icon: "◷" },
        ].map((metric) => (
          <article className="overview-metric-card" key={metric.label}>
            <span className={`overview-metric-icon overview-tone-${metric.tone}`} aria-hidden="true">{metric.icon}</span>
            <span className="overview-metric-copy"><small>{metric.label}</small><strong>{metric.value}</strong></span>
          </article>
        ))}
      </div>

      <div className="overview-charts-grid">
        <article className="overview-card overview-trend-card">
          <div className="overview-card-heading">
            <h2>Milestone delivery trend</h2>
            <span className="overview-period">Last 6 months</span>
          </div>
          <ProjectHealthChart trend={trend} />
        </article>

        <article className="overview-card overview-milestone-card">
          <div className="overview-card-heading"><h2>Milestone status</h2></div>
          <div className="overview-milestone-content">
            <div className="overview-donut" style={{ background: ringBackground }} aria-label={`${totalMilestones} milestones`}>
              <div><strong>{totalMilestones}</strong><small>Milestones</small></div>
            </div>
            <div className="overview-legend">
              {[
                { label: "Completed", value: completed, tone: "green" },
                { label: "In progress", value: inProgress, tone: "blue" },
                { label: "Upcoming", value: upcoming, tone: "gray" },
                { label: "Delayed", value: delayed, tone: "red" },
              ].map((item) => (
                <div key={item.label}><i className={`overview-legend-dot overview-tone-${item.tone}`} /><span>{item.label}</span><strong>{item.value}</strong></div>
              ))}
            </div>
          </div>
        </article>

        <article className="overview-card overview-risk-card">
          <div className="overview-card-heading">
            <h2>Top risks</h2>
            <button type="button" className="overview-link" onClick={() => go("/risks")}>View all</button>
          </div>
          <div className="overview-risk-list">
            {risks.map((risk) => (
              <button type="button" className="overview-risk-item" key={risk.id} onClick={() => go("/risks")}>
                <span><strong>{risk.title}</strong><small>{risk.project_name ?? "—"}</small></span>
                <span className={`overview-risk-pill overview-risk-${risk.severity.toLowerCase()}`}>{risk.severity}</span>
              </button>
            ))}
            {!risks.length ? <p className="overview-muted">No active risks.</p> : null}
          </div>
        </article>
      </div>

      <div className="overview-bottom-grid">
        <article className="overview-card overview-activity-card">
          <div className="overview-card-heading"><h2>Recent activity</h2></div>
          <div className="overview-activity-list">
            {activity.slice(0, 4).map((item) => (
              <button type="button" className="overview-activity-item" key={item.id} onClick={() => go(linkFor[item.link])}>
                <i className={`overview-activity-dot overview-activity-${item.tone}`} />
                <span>{item.label}</span>
                <small>{formatRelative(item.when)}</small>
              </button>
            ))}
            {!activity.length ? <p className="overview-muted">No recent activity.</p> : null}
          </div>
        </article>

        <article className="overview-card overview-priority-card">
          <div className="overview-card-heading">
            <h2>Priority actions</h2>
            <button type="button" className="overview-link" onClick={() => go("/actions")}>View all</button>
          </div>
          <div className="overview-priority-list">
            {actions.map((action) => (
              <button type="button" className="overview-priority-item" key={action.id} onClick={() => go("/actions")}>
                <span><strong>{action.title}</strong><small>{action.owner ?? "Unassigned"} · Due {action.due_date ?? "—"}</small></span>
                <span className={`overview-risk-pill overview-risk-${action.priority.toLowerCase()}`}>{action.is_overdue ? "Overdue" : action.priority}</span>
              </button>
            ))}
            {!actions.length ? <p className="overview-muted">No open actions.</p> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
