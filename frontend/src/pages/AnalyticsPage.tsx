import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import api from "../api/client";
import { getApiErrorMessage } from "../api/errors";
import type { DashboardSummary } from "../types";

export function AnalyticsPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const projectCode = searchParams.get("project_code") ?? "";
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const params = projectCode ? { project_code: projectCode } : undefined;
    api.get<DashboardSummary>("/dashboard/summary", { params })
      .then(({ data }) => {
        if (active) {
          setSummary(data);
          setError("");
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(getApiErrorMessage(loadError, "Could not load analytics."));
      });

    return () => {
      active = false;
    };
  }, [projectCode]);

  const data = useMemo(
    () => [
      { name: "Running", value: summary?.running ?? 0 },
      { name: "Blocked", value: summary?.blocked ?? 0 },
      { name: "Completed", value: summary?.completed ?? 0 },
    ],
    [summary],
  );

  return (
    <section className="analytics-page">
      <header className="page-heading">
        <div>
          <h1>Workflow Analytics</h1>
          <p className="page-subtitle">
            {projectCode ? `Run status for ${projectCode}.` : "Run status across all projects."}
          </p>
        </div>
      </header>
      {error ? <div className="dashboard-error" role="alert">{error}</div> : null}
      <div className="summary-grid analytics-summary">
        <article className="summary-card"><div className="summary-copy"><span className="summary-label">Total Runs</span><strong>{summary?.total_runs ?? "…"}</strong></div></article>
        <article className="summary-card"><div className="summary-copy"><span className="summary-label">Running</span><strong>{summary?.running ?? "…"}</strong></div></article>
        <article className="summary-card"><div className="summary-copy"><span className="summary-label">Blocked</span><strong>{summary?.blocked ?? "…"}</strong></div></article>
        <article className="summary-card"><div className="summary-copy"><span className="summary-label">Completed</span><strong>{summary?.completed ?? "…"}</strong></div></article>
      </div>
      <div className="chart-card">
        {summary ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#1d4ed8" />
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="muted">{error ? "Analytics data is unavailable." : "Loading analytics…"}</p>}
      </div>
    </section>
  );
}
