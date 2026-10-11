import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import api from "../api/client";
import { getApiErrorMessage } from "../api/errors";
import { useApiData } from "../api/useApiData";
import { useBusiness } from "../api/useBusiness";
import { ErrorState, LoadingState, Notice } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import type { DependencyGraph, GraphNode, ProjectList, SimulationResult } from "../types";
import { formatDate } from "../components/ProjectUi";

type View = "Dependency graph" | "Bottleneck analysis" | "Impact simulation";

const VIEWS: View[] = ["Dependency graph", "Bottleneck analysis", "Impact simulation"];
const WRITE_ROLES = ["admin", "manager", "engineering"];
const NODE_W = 190;
const NODE_H = 66;
const COL_GAP = 70;
const ROW_GAP = 26;
const PAD = 18;

function nodeKind(status: string): string {
  if (status === "Completed") return "completed";
  if (status === "At Risk") return "risk";
  if (status === "In Progress") return "progress";
  if (status === "Delayed") return "delayed";
  return "not-started";
}

const shortDate = (value: string | null): string =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "No date";

export function DependenciesPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { business } = useBusiness();
  const canWrite = WRITE_ROLES.includes(user?.role ?? "");

  const projects = useApiData<ProjectList>("/projects", { page_size: 100, business });
  const [projectId, setProjectId] = useState(searchParams.get("project_id") ?? "");
  const activeId = projectId || (projects.data?.items[0] ? String(projects.data.items[0].id) : "");
  const graphState = useApiData<DependencyGraph>(activeId ? `/projects/${activeId}/dependencies` : null);

  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [view, setView] = useState<View>("Dependency graph");
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [simNode, setSimNode] = useState("");
  const [simDays, setSimDays] = useState("2");
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setGraph(graphState.data);
    setSelected(null);
    setSimulation(null);
    setFrom("");
    setTo("");
  }, [graphState.data]);

  const nodes = graph?.nodes ?? [];
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const layout = useMemo(() => {
    const columns = new Map<number, GraphNode[]>();
    nodes.forEach((node) => columns.set(node.level, [...(columns.get(node.level) ?? []), node]));
    const positions = new Map<number, { x: number; y: number }>();
    let rows = 1;
    columns.forEach((column, level) => {
      rows = Math.max(rows, column.length);
      column.forEach((node, row) => positions.set(node.id, { x: PAD + level * (NODE_W + COL_GAP), y: PAD + row * (NODE_H + ROW_GAP) }));
    });
    const levels = columns.size || 1;
    return {
      positions,
      width: PAD * 2 + levels * NODE_W + (levels - 1) * COL_GAP,
      height: PAD * 2 + rows * NODE_H + (rows - 1) * ROW_GAP,
    };
  }, [nodes]);

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (failure) {
      setError(getApiErrorMessage(failure, fallback));
    } finally {
      setBusy(false);
    }
  };

  const addLink = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(async () => {
      const { data } = await api.post<DependencyGraph>(`/projects/${activeId}/dependencies`, { predecessor_id: Number(from), successor_id: Number(to) });
      setGraph(data);
      setFrom("");
      setTo("");
    }, "Could not add this dependency.");
  };

  const removeLink = (id: number) => void run(async () => {
    const { data } = await api.delete<DependencyGraph>(`/projects/${activeId}/dependencies/${id}`);
    setGraph(data);
  }, "Could not remove this dependency.");

  const simulate = (milestoneId: number, days: number) => void run(async () => {
    const { data } = await api.post<SimulationResult>(`/projects/${activeId}/dependencies/simulate`, { milestone_id: milestoneId, delay_days: days });
    setSimulation(data);
  }, "Could not run the simulation.");

  const runDefaultSimulation = () => {
    const target = graph?.bottleneck?.milestone_id ?? nodes[0]?.id;
    setView("Impact simulation");
    setSimNode(target ? String(target) : "");
    if (target) simulate(target, Number(simDays) || 2);
  };

  const submitSimulation = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const days = Number(simDays);
    if (!simNode || !Number.isInteger(days) || days < 1 || days > 365) {
      setError("Choose a milestone and a delay of 1 to 365 days.");
      return;
    }
    simulate(Number(simNode), days);
  };

  const bottleneck = graph?.bottleneck ?? null;
  const critical = (graph?.critical_path ?? []).map((id) => byId.get(id)).filter((node): node is GraphNode => Boolean(node));
  const nameOf = (id: number) => byId.get(id)?.name ?? `Milestone ${id}`;

  if (projects.loading && !projects.data) return <section className="feature-page dependencies-page"><LoadingState /></section>;

  return (
    <section className="feature-page dependencies-page">
      <header className="feature-heading">
        <div><h1>Dependencies &amp; bottleneck analysis</h1><p>Visualize task dependencies and the critical path</p></div>
        <div className="milestone-heading-actions">
          <label className="visually-hidden" htmlFor="dependency-project">Project</label>
          <select id="dependency-project" aria-label="Project" value={activeId} onChange={(event) => setProjectId(event.target.value)}>
            {(projects.data?.items ?? []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <button type="button" className="simulation-button" disabled={!nodes.length || busy} onClick={runDefaultSimulation}>Run simulation</button>
        </div>
      </header>

      <div className="dependency-tabs" role="tablist" aria-label="Dependency analysis">
        {VIEWS.map((item) => (
          <button key={item} type="button" role="tab" aria-selected={view === item} className={view === item ? "is-selected" : ""} onClick={() => { setView(item); setSelected(null); }}>{item}</button>
        ))}
      </div>

      <Notice message={error} tone="error" />
      {projects.error ? <ErrorState message={projects.error} onRetry={projects.reload} /> : null}
      {!activeId && projects.data ? <p className="pl-state">No projects yet. Create a project and add milestones to see dependencies.</p> : null}
      {graphState.error ? <ErrorState message={graphState.error} onRetry={graphState.reload} /> : null}
      {graphState.loading && !graph ? <LoadingState label="Loading dependencies…" /> : null}

      {graph && view === "Dependency graph" ? (
        <section className="feature-card dependency-graph-card" aria-labelledby="dependency-graph-title">
          <div className="feature-card-heading">
            <h2 id="dependency-graph-title">{graph.project_name} · task dependencies</h2>
            <div className="dependency-legend"><span><i className="legend-critical" />Critical path</span><span><i className="legend-related" />Related flow</span></div>
          </div>
          {!nodes.length ? <p className="pl-muted">This project has no milestones yet. Add milestones, then link them here.</p> : (
            <div className="dep-scroll">
              <div className="dep-canvas" style={{ width: layout.width, height: layout.height }} role="group" aria-label="Dependency graph">
                <svg className="dep-edges" width={layout.width} height={layout.height} aria-hidden="true">
                  <defs>
                    <marker id="critical-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="#d92f27" /></marker>
                    <marker id="related-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="#8b9bb5" /></marker>
                  </defs>
                  {graph.edges.map((edge) => {
                    const a = layout.positions.get(edge.from_id);
                    const b = layout.positions.get(edge.to_id);
                    if (!a || !b) return null;
                    const x1 = a.x + NODE_W;
                    const y1 = a.y + NODE_H / 2;
                    const x2 = b.x;
                    const y2 = b.y + NODE_H / 2;
                    const bend = Math.max(24, (x2 - x1) / 2);
                    return (
                      <path
                        key={edge.id}
                        d={`M${x1} ${y1} C${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2 - 2} ${y2}`}
                        className={edge.on_critical_path ? "connector-critical" : "connector-related"}
                        markerEnd={`url(#${edge.on_critical_path ? "critical" : "related"}-arrow)`}
                      />
                    );
                  })}
                </svg>
                {nodes.map((node) => {
                  const position = layout.positions.get(node.id);
                  if (!position) return null;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      className={`dependency-node-button dependency-node-button--${nodeKind(node.status)}${node.on_critical_path ? " dep-critical" : ""}${node.is_bottleneck ? " dep-bottleneck" : ""}`}
                      style={{ position: "absolute", left: position.x, top: position.y, width: NODE_W, height: NODE_H }}
                      onClick={() => setSelected(node)}
                      aria-label={`${node.name}, ${shortDate(node.forecast_date ?? node.due_date)}, ${node.status}`}
                    >
                      <strong>{node.name}</strong>
                      <span>{shortDate(node.forecast_date ?? node.due_date)} · {node.status}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {selected ? (
            <p className="dependency-selection" role="status">
              <strong>{selected.name}</strong> · due {formatDate(selected.due_date)} · {selected.status} · {selected.progress}% · gates {selected.downstream} downstream milestone(s)
            </p>
          ) : null}

          <div className="dep-links">
            <h3>Links</h3>
            {graph.edges.length ? (
              <ul>
                {graph.edges.map((edge) => (
                  <li key={edge.id} className={edge.on_critical_path ? "is-critical" : ""}>
                    <span>{nameOf(edge.from_id)} <b aria-hidden="true">→</b> {nameOf(edge.to_id)}</span>
                    {canWrite ? <button type="button" className="table-action-button" aria-label={`Remove link ${nameOf(edge.from_id)} to ${nameOf(edge.to_id)}`} disabled={busy} onClick={() => removeLink(edge.id)}>Remove</button> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="pl-muted">No dependencies defined yet.</p>}
            {canWrite && nodes.length > 1 ? (
              <form className="dep-add" onSubmit={addLink}>
                <label>Predecessor
                  <select value={from} onChange={(event) => setFrom(event.target.value)} required>
                    <option value="">Select milestone</option>
                    {nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
                  </select>
                </label>
                <label>Successor
                  <select value={to} onChange={(event) => setTo(event.target.value)} required>
                    <option value="">Select milestone</option>
                    {nodes.filter((node) => String(node.id) !== from).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
                  </select>
                </label>
                <button type="submit" className="secondary-button" disabled={busy || !from || !to}>Add dependency</button>
              </form>
            ) : null}
          </div>
        </section>
      ) : null}

      {graph && view === "Bottleneck analysis" ? (
        <section className="feature-card dependency-analysis-card" aria-labelledby="dependency-analysis-title">
          <div className="feature-card-heading"><div><h2 id="dependency-analysis-title">Bottleneck analysis</h2><p>{graph.project_name} · based on current milestone links</p></div></div>
          {bottleneck ? (
            <div className="bottleneck-content">
              <span className="bottleneck-indicator" aria-hidden="true">!</span>
              <div>
                <strong>{bottleneck.name} is the current bottleneck</strong>
                <p>{bottleneck.reason} Resolve it first to protect the milestones that depend on it.</p>
              </div>
            </div>
          ) : <p className="pl-muted">No bottleneck detected. No delayed or at-risk milestone is blocking other work.</p>}
          <div>
            <h3 className="dep-subheading">Critical path</h3>
            {critical.length ? (
              <ol className="dep-path">{critical.map((node) => <li key={node.id}><strong>{node.name}</strong><small>{shortDate(node.forecast_date ?? node.due_date)} · {node.status}</small></li>)}</ol>
            ) : <p className="pl-muted">Link at least two unfinished milestones to see a critical path.</p>}
          </div>
        </section>
      ) : null}

      {graph && view === "Impact simulation" ? (
        <section className="feature-card dependency-analysis-card" aria-labelledby="dependency-analysis-title">
          <div className="feature-card-heading"><div><h2 id="dependency-analysis-title">Impact simulation</h2><p>{graph.project_name} · see how a slip spreads through the plan</p></div></div>
          <form className="dep-add" onSubmit={submitSimulation}>
            <label>Delayed milestone
              <select value={simNode} onChange={(event) => setSimNode(event.target.value)}>
                <option value="">Select milestone</option>
                {nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
              </select>
            </label>
            <label>Delay (days)<input type="number" min={1} max={365} value={simDays} onChange={(event) => setSimDays(event.target.value)} /></label>
            <button type="submit" className="secondary-button" disabled={busy}>Simulate delay</button>
          </form>
          {simulation ? (
            <div className="impact-content">
              <p role="status"><strong>{simulation.summary}</strong></p>
              <div className="responsive-table-wrap">
                <table className="feature-table">
                  <thead><tr><th>Milestone</th><th>Planned</th><th>New date</th><th>Slip</th></tr></thead>
                  <tbody>
                    {simulation.impacts.map((impact) => (
                      <tr key={impact.milestone_id}><td>{impact.name}</td><td>{formatDate(impact.original_date)}</td><td>{formatDate(impact.new_date)}</td><td>+{impact.shift_days} d</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : <p className="pl-muted">Choose a milestone and a delay to preview the schedule impact. Nothing is saved.</p>}
        </section>
      ) : null}

      {graph ? (
        <div className="dependency-footer-grid">
          <article className="feature-card bottleneck-summary">
            <h2>{bottleneck ? "Bottleneck detected" : "No bottleneck"}</h2>
            <p>{bottleneck ? bottleneck.reason : "Nothing is currently blocking downstream milestones."}</p>
          </article>
          <article className="feature-card impact-summary"><span aria-hidden="true">✧</span><div><h2>Understand impact</h2><p>Simulate a delay on any milestone to see which dates move.</p></div></article>
        </div>
      ) : null}
    </section>
  );
}
