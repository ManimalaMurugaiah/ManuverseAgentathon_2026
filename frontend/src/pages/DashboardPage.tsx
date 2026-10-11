import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import api from "../api/client";
import { getApiErrorMessage } from "../api/errors";
import { useAuth } from "../context/AuthContext";
import type { DashboardSummary, WorkflowRun } from "../types";

const workflowStages = [
  "Design Freeze",
  "Drawing Approval",
  "PO Release",
  "Vendor Manufacturing",
  "FAT",
  "Shipment",
  "Site Readiness",
  "Equipment Delivery",
  "Installation",
  "Mechanical Completion",
  "SAT",
  "Commissioning",
  "Production Handover",
];

const emptySummary: DashboardSummary = {
  total_runs: 0,
  running: 0,
  blocked: 0,
  completed: 0,
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function stageTone(stage: string, activeStages: Set<string>): string {
  return activeStages.has(stage) ? "success" : "idle";
}

export function DashboardPage(): JSX.Element {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const projectCode = searchParams.get("project_code") ?? "";
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [question, setQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    let active = true;
    const params = projectCode ? { project_code: projectCode } : undefined;

    const loadDashboard = async () => {
      setLoading(true);
      setError("");
      try {
        const [summaryResponse, runsResponse] = await Promise.all([
          api.get<DashboardSummary>("/dashboard/summary", { params }),
          api.get<WorkflowRun[]>("/workflow/runs", { params: { ...params, limit: 50 } }),
        ]);
        if (active) {
          setSummary(summaryResponse.data);
          setRuns(runsResponse.data);
        }
      } catch (loadError) {
        if (active) setError(getApiErrorMessage(loadError, "Could not load dashboard data."));
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadDashboard();
    return () => {
      active = false;
    };
  }, [projectCode, refreshKey]);

  const activeStages = useMemo(
    () => new Set(runs.filter((run) => run.status === "running").map((run) => run.current_stage)),
    [runs],
  );
  const otherRuns = Math.max(summary.total_runs - summary.running - summary.blocked - summary.completed, 0);
  const health = summary.blocked > 0 ? "AT RISK" : summary.total_runs > 0 ? "ON TRACK" : "NO DATA";
  const ringBackground = summary.total_runs > 0
    ? `conic-gradient(#18a66b 0 ${(summary.running / summary.total_runs) * 100}%, #ea4a4d ${(summary.running / summary.total_runs) * 100}% ${((summary.running + summary.blocked) / summary.total_runs) * 100}%, #3978f6 ${((summary.running + summary.blocked) / summary.total_runs) * 100}% ${((summary.running + summary.blocked + summary.completed) / summary.total_runs) * 100}%, #a9b6c8 ${((summary.running + summary.blocked + summary.completed) / summary.total_runs) * 100}% 100%)`
    : "conic-gradient(#e8edf5 0 100%)";
  const insightRuns = runs.filter((run) => run.status === "blocked" || run.status === "running").slice(0, 3);

  const sendQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = question.trim();
    if (!message || chatLoading) return;

    setChatMessages((current) => [...current, { role: "user", content: message }]);
    setQuestion("");
    setChatLoading(true);
    try {
      const { data } = await api.post<{ reply: string }>("/assistant/chat", {
        message,
        ...(projectCode ? { project_code: projectCode } : {}),
      });
      setChatMessages((current) => [...current, { role: "assistant", content: data.reply }]);
    } catch (chatError) {
      setChatMessages((current) => [
        ...current,
        { role: "assistant", content: getApiErrorMessage(chatError, "The assistant could not answer right now.") },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <section className="dashboard-shell">
      <div className="main-panel">
        <div className="hero-row">
          <div className="hero-copy">
            <h1>Hello {user?.username ?? "there"} <span aria-hidden="true">👋</span></h1>
            <p>
              {projectCode
                ? `Your AI Project Orchestrator is monitoring ${projectCode}.`
                : "Your AI Project Orchestrator is monitoring all projects."}
            </p>
            <span className="hero-caption">
              {loading ? "Refreshing live workflow data…" : "Live status from workflow runs stored in your workspace."}
            </span>
          </div>

          <div className="bot-bubble-wrap">
            <div className="bot-bubble">
              {summary.blocked > 0
                ? `${summary.blocked} workflow${summary.blocked === 1 ? "" : "s"} blocked; review the latest activity.`
                : summary.total_runs > 0
                  ? `${summary.running} workflow${summary.running === 1 ? "" : "s"} currently in progress.`
                  : "Start a workflow to see live project status here."}
            </div>
            <div className="bot-robot" aria-hidden="true">
              <span className="bot-head" />
              <span className="bot-eye left" />
              <span className="bot-eye right" />
              <span className="bot-body" />
              <span className="bot-arm left" />
              <span className="bot-arm right" />
            </div>
          </div>
        </div>

        {error ? (
          <div className="dashboard-error" role="alert">
            <span>{error}</span>
            <button type="button" className="text-button" onClick={() => setRefreshKey((value) => value + 1)}>
              Retry
            </button>
          </div>
        ) : null}

        <div className="summary-grid">
          {[
            { label: "Total Runs", value: summary.total_runs, tone: "blue", icon: "▣" },
            { label: "Running", value: summary.running, tone: "green", icon: "✓" },
            { label: "Blocked", value: summary.blocked, tone: "red", icon: "!" },
            { label: "Completed", value: summary.completed, tone: "amber", icon: "◷" },
            { label: "Project Health", value: health, tone: "purple", icon: "◉" },
          ].map((card) => (
            <article key={card.label} className={`summary-card summary-card--${card.tone}`}>
              <span className={`summary-icon icon-${card.tone}`} aria-hidden="true">{card.icon}</span>
              <div className="summary-copy">
                <span className="summary-label">{card.label}</span>
                <strong>{loading ? "…" : card.value}</strong>
              </div>
            </article>
          ))}
        </div>

        <div className="project-grid">
          <article className="white-card timeline-card">
            <div className="card-head">
              <div className="card-title-wrap">
                <span className="card-icon blue">▣</span>
                <h2>Workflow Stage Progress</h2>
              </div>
              <span className="count-pill">{summary.running} active</span>
            </div>
            <div className="timeline-scroll">
              <div className="timeline-row">
                {workflowStages.map((stage, index) => {
                  const count = runs.filter((run) => run.status === "running" && run.current_stage === stage).length;
                  const tone = stageTone(stage, activeStages);
                  return (
                    <div key={stage} className="timeline-step">
                      <div className={`step-dot dot-${tone}`}>{count || index + 1}</div>
                      <div className="step-name">{stage}</div>
                      <div className="step-date">{count ? `${count} active` : "Workflow stage"}</div>
                      {index < workflowStages.length - 1 ? <span className="connector" aria-hidden="true" /> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </article>

          <article className="white-card status-card">
            <div className="card-head">
              <div className="card-title-wrap">
                <span className="card-icon blue">◉</span>
                <h2>Run Status</h2>
              </div>
            </div>
            <div className="donut-layout">
              <div className="donut-chart" style={{ background: ringBackground }} aria-label="Workflow run status chart">
                <div className="donut-center">
                  <strong>{loading ? "…" : summary.total_runs}</strong>
                  <span>Workflow runs</span>
                </div>
              </div>
              <div className="status-legend">
                {[
                  { label: "Running", value: summary.running, tone: "green" },
                  { label: "Blocked", value: summary.blocked, tone: "red" },
                  { label: "Completed", value: summary.completed, tone: "amber" },
                  ...(otherRuns > 0 ? [{ label: "Other", value: otherRuns, tone: "gray" }] : []),
                ].map((item) => (
                  <div className="legend-line" key={item.label}>
                    <span className={`legend-mark ${item.tone}`} />
                    <span className="legend-text">{item.label}</span>
                    <strong>{loading ? "…" : item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>

        <div className="insights-grid">
          {insightRuns.length > 0 ? insightRuns.map((run) => {
            const blocked = run.status === "blocked";
            return (
              <article
                key={run.id}
                className={`insight-card insight-card--${blocked ? "critical" : "action"}`}
              >
                <div className="insight-badge">{blocked ? "Blocked workflow" : "Workflow in progress"}</div>
                <div className="insight-title">{run.project_code} · Run #{run.id}</div>
                <div className="insight-body">{run.current_stage}</div>
                <div className="insight-detail">
                  {blocked ? "This workflow is blocked and needs an approval decision." : "This workflow is awaiting its next approval."}
                </div>
              </article>
            );
          }) : (
            <article className="insight-card insight-card--action">
              <div className="insight-badge">No issues reported</div>
              <div className="insight-title">{summary.total_runs ? "No active or blocked workflows" : "No workflow runs yet"}</div>
              <div className="insight-body">
                {summary.total_runs ? "There are no running or blocked workflows in this project filter." : "Create a workflow run to start tracking project progress."}
              </div>
            </article>
          )}
        </div>

        <div className="bottom-grid">
          <article className="white-card activity-card">
            <div className="card-head">
              <div className="card-title-wrap">
                <span className="card-icon purple">⏱</span>
                <h2>Recent Workflow Activity</h2>
              </div>
              <button type="button" className="text-link" onClick={() => setRefreshKey((value) => value + 1)}>
                Refresh
              </button>
            </div>
            {runs.length ? (
              <ul className="activity-list">
                {runs.slice(0, 5).map((run) => (
                  <li key={run.id} className="activity-item">
                    <span className={`activity-bullet bullet-${run.status === "blocked" ? "alert" : run.status === "completed" ? "ok" : "warn"}`} aria-hidden="true" />
                    <div className="activity-text">
                      <span>{run.project_code} · {run.status} at {run.current_stage}</span>
                      <small>{formatDate(run.updated_at)}</small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{loading ? "Loading workflow activity…" : "No workflow activity to show yet."}</p>
            )}
          </article>

          <article className="white-card health-card">
            <div className="card-head">
              <div className="card-title-wrap">
                <span className="card-icon blue">◔</span>
                <h2>Workflow Summary</h2>
              </div>
            </div>
            <div className="distribution-list">
              {[
                { label: "Running", value: summary.running, tone: "green" },
                { label: "Blocked", value: summary.blocked, tone: "red" },
                { label: "Completed", value: summary.completed, tone: "blue" },
              ].map((item) => (
                <div className="distribution-row" key={item.label}>
                  <div className="distribution-label"><span className={`legend-mark ${item.tone}`} />{item.label}<strong>{item.value}</strong></div>
                  <div className="distribution-track">
                    <span
                      className={`distribution-fill ${item.tone}`}
                      style={{ width: `${summary.total_runs ? (item.value / summary.total_runs) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="health-note">
              {loading ? "Refreshing workflow counts…" : `${summary.total_runs} total runs${projectCode ? ` for ${projectCode}` : " across all projects"}.`}
            </div>
          </article>
        </div>
      </div>

      <aside className="agent-panel">
        <div className="agent-header">
          <div className="agent-brand">
            <span className="mini-avatar">AI</span>
            <span>AI Agent</span>
          </div>
          <div className="presence-wrap">
            <span className="presence-dot" aria-hidden="true" />
            <span className="presence-text">Online</span>
          </div>
        </div>

        <div className="agent-body">
          <div className="agent-message">
            <strong>Hi {user?.username ?? "there"}!</strong>
            <span>
              {loading
                ? "Loading live workflow information."
                : `${summary.total_runs} total runs: ${summary.running} running, ${summary.blocked} blocked, ${summary.completed} completed.`}
            </span>
          </div>
          <div className="agent-insight-list">
            <div className="panel-subtitle">Latest workflow runs</div>
            {runs.slice(0, 3).map((run) => (
              <div className="agent-list-item" key={run.id}>
                <span className="agent-index">{run.id}</span>
                {run.project_code}: {run.status} at {run.current_stage}
              </div>
            ))}
            {!runs.length ? <div className="agent-list-item">No workflow runs are available for this project.</div> : null}
          </div>
          <div className="panel-actions">
            <div className="panel-subtitle">Project data</div>
            <ul>
              <li>Answers use current workflow run data.</li>
              <li>AI provider settings are managed by the backend.</li>
            </ul>
          </div>
        </div>

        <div className="chat-history" aria-live="polite">
          {chatMessages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`chat-message chat-message--${message.role}`}>
              {message.content}
            </div>
          ))}
          {chatLoading ? <div className="chat-message chat-message--assistant">Thinking…</div> : null}
        </div>

        <form className="chat-input-row" onSubmit={sendQuestion}>
          <input
            type="text"
            aria-label="Ask the AI assistant"
            placeholder="Ask about your workflow runs..."
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={2000}
            disabled={chatLoading}
          />
          <button type="submit" aria-label="Send" disabled={chatLoading || !question.trim()}>➤</button>
        </form>
        <div className="agent-quick-actions">
          <button type="button" onClick={() => setQuestion("Which workflow runs are blocked?")}>Analyze risks</button>
          <button type="button" onClick={() => setQuestion("Summarize current workflow stages.")}>Show stages</button>
          <button type="button" onClick={() => setQuestion("How do I advance a workflow run?")}>Next steps</button>
        </div>
      </aside>
    </section>
  );
}
