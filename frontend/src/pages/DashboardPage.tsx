import { useSearchParams, useNavigate } from "react-router-dom";

import { sampleActions, sampleBusinesses, sampleRisks } from "./sampleData";

const businessMetrics: Record<string, {
  projects: number;
  onTrack: number;
  atRisk: number;
  delayed: number;
  milestones: { completed: number; inProgress: number; upcoming: number; delayed: number };
}> = {
  [sampleBusinesses[0]]: { projects: 12, onTrack: 5, atRisk: 4, delayed: 3, milestones: { completed: 10, inProgress: 8, upcoming: 4, delayed: 2 } },
  [sampleBusinesses[1]]: { projects: 9, onTrack: 5, atRisk: 2, delayed: 2, milestones: { completed: 9, inProgress: 6, upcoming: 3, delayed: 2 } },
  [sampleBusinesses[2]]: { projects: 8, onTrack: 5, atRisk: 2, delayed: 1, milestones: { completed: 8, inProgress: 5, upcoming: 3, delayed: 1 } },
  [sampleBusinesses[3]]: { projects: 10, onTrack: 6, atRisk: 2, delayed: 2, milestones: { completed: 11, inProgress: 7, upcoming: 4, delayed: 2 } },
  [sampleBusinesses[4]]: { projects: 7, onTrack: 4, atRisk: 2, delayed: 1, milestones: { completed: 7, inProgress: 5, upcoming: 3, delayed: 1 } },
};

const businessTrends: Record<string, number[]> = {
  [sampleBusinesses[0]]: [44, 52, 49, 65, 72, 82],
  [sampleBusinesses[1]]: [38, 46, 54, 57, 68, 75],
  [sampleBusinesses[2]]: [49, 55, 51, 63, 69, 78],
  [sampleBusinesses[3]]: [42, 50, 58, 56, 70, 84],
  [sampleBusinesses[4]]: [35, 43, 48, 61, 65, 73],
};

const monthLabels = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];

function ProjectHealthChart({ values }: Readonly<{ values: number[] }>): JSX.Element {
  const points = values.map((value, index) => ({
    x: 46 + index * 99,
    y: 174 - value * 1.35,
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `46,184 ${line} ${points[points.length - 1].x},184`;

  return (
    <svg className="overview-chart" viewBox="0 0 560 220" role="img" aria-label="Project health trend for the last six months">
      {[40, 80, 120, 160].map((y, index) => (
        <g key={y}>
          <line x1="42" y1={y} x2="548" y2={y} className="overview-chart-grid" />
          <text x="4" y={y + 4} className="overview-chart-axis">{100 - index * 25}</text>
        </g>
      ))}
      <polygon points={area} className="overview-chart-area" />
      <polyline points={line} className="overview-chart-line" />
      {points.map((point, index) => (
        <g key={monthLabels[index]}>
          <circle cx={point.x} cy={point.y} r="5" className="overview-chart-point" />
          <text x={point.x} y="207" textAnchor="middle" className="overview-chart-axis">{monthLabels[index]}</text>
        </g>
      ))}
    </svg>
  );
}

export function DashboardPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestedBusiness = searchParams.get("business") ?? "";
  const business = sampleBusinesses.includes(requestedBusiness) ? requestedBusiness : "";
  const metrics = business ? businessMetrics[business] : null;
  const trend = business ? businessTrends[business] : [];
  const risks = sampleRisks.filter((risk) => risk.business === business && risk.status !== "Resolved");
  const actions = sampleActions.filter((action) => action.business === business && action.status !== "Completed");
  const milestoneCounts = metrics?.milestones ?? { completed: 0, inProgress: 0, upcoming: 0, delayed: 0 };
  const totalMilestones = milestoneCounts.completed + milestoneCounts.inProgress + milestoneCounts.upcoming + milestoneCounts.delayed;
  const { completed, inProgress, upcoming, delayed } = milestoneCounts;
  const ringBackground = totalMilestones
    ? `conic-gradient(#149f69 0 ${(completed / totalMilestones) * 100}%, #3477f6 ${(completed / totalMilestones) * 100}% ${((completed + inProgress) / totalMilestones) * 100}%, #cbd6e8 ${((completed + inProgress) / totalMilestones) * 100}% ${((completed + inProgress + upcoming) / totalMilestones) * 100}%, #e9474c ${((completed + inProgress + upcoming) / totalMilestones) * 100}% 100%)`
    : "conic-gradient(#e8edf5 0 100%)";
  const activities = [
    ...risks.map((risk) => ({
      id: risk.id,
      label: risk.title,
      detail: risk.business,
      status: risk.severity === "High" ? "alert" : "warn",
      when: "Today",
    })),
    ...actions.map((action) => ({
      id: action.id,
      label: action.title,
      detail: action.business,
      status: action.status === "Overdue" ? "alert" : "ok",
      when: action.status === "Overdue" ? "Today" : "Yesterday",
    })),
  ].slice(0, 4);

  const navigateWithBusiness = (path: string) => navigate({
    pathname: path,
    search: searchParams.toString() ? `?${searchParams.toString()}` : "",
  });

  if (!business || !metrics) {
    return (
      <section className="overview-page overview-onboarding">
        <header className="overview-heading">
          <div>
            <h1>Project Overview</h1>
            <p>Executive dashboard with real-time project health</p>
          </div>
        </header>
        <section className="overview-empty-state">
          <span className="overview-empty-icon" aria-hidden="true">▣</span>
          <h2>Select a business to get started</h2>
          <p>Choose one of the five sample businesses from the dropdown above to view its projects, milestones, risks, and activity.</p>
        </section>
      </section>
    );
  }

  return (
    <section className="overview-page">
      <header className="overview-heading">
        <div>
          <h1>Project Overview</h1>
          <p>Executive dashboard with real-time project health</p>
        </div>
      </header>

      <div className="overview-metrics">
        {[
          { label: "Total projects", value: metrics.projects, tone: "blue", icon: "☰" },
          { label: "On track", value: metrics.onTrack, tone: "green", icon: "✓" },
          { label: "At risk", value: metrics.atRisk, tone: "amber", icon: "⚠" },
          { label: "Delayed", value: metrics.delayed, tone: "red", icon: "◷" },
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
            <h2>Project health trend</h2>
            <span className="overview-period">Last 6 months</span>
          </div>
          <ProjectHealthChart values={trend} />
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
            <button type="button" className="overview-link" onClick={() => navigateWithBusiness("/risks")}>View all</button>
          </div>
          <div className="overview-risk-list">
            {risks.slice(0, 3).map((risk) => (
              <button type="button" className="overview-risk-item" key={risk.id} onClick={() => navigateWithBusiness("/risks")}>
                <span><strong>{risk.title}</strong><small>{risk.line}</small></span>
                <span className={`overview-risk-pill overview-risk-${risk.severity.toLowerCase()}`}>{risk.severity}</span>
              </button>
            ))}
            {!risks.length ? <p className="overview-muted">No active risks for this business.</p> : null}
          </div>
        </article>
      </div>

      <div className="overview-bottom-grid">
        <article className="overview-card overview-activity-card">
          <div className="overview-card-heading"><h2>Recent activity</h2></div>
          <div className="overview-activity-list">
            {activities.map((activity) => (
              <button
                type="button"
                className="overview-activity-item"
                key={activity.id}
                onClick={() => navigateWithBusiness(activity.status === "alert" || activity.status === "warn" ? "/risks" : "/actions")}
              >
                <i className={`overview-activity-dot overview-activity-${activity.status}`} />
                <span>{activity.label}</span>
                <small>{activity.when}</small>
              </button>
            ))}
            {!activities.length ? <p className="overview-muted">No recent business activity.</p> : null}
          </div>
        </article>

        <article className="overview-card overview-priority-card">
          <div className="overview-card-heading">
            <h2>Priority actions</h2>
            <button type="button" className="overview-link" onClick={() => navigateWithBusiness("/actions")}>View all</button>
          </div>
          <div className="overview-priority-list">
            {actions.slice(0, 3).map((action) => (
              <button type="button" className="overview-priority-item" key={action.id} onClick={() => navigateWithBusiness("/actions")}>
                <span><strong>{action.title}</strong><small>{action.owner} · Due {action.dueDate}</small></span>
                <span className={`overview-risk-pill overview-risk-${action.priority.toLowerCase()}`}>{action.status === "Overdue" ? "Overdue" : action.priority}</span>
              </button>
            ))}
            {!actions.length ? <p className="overview-muted">No open actions for this business.</p> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
