import { useState } from "react";

type DependencyView = "Dependency graph" | "Bottleneck analysis" | "Impact simulation";

interface DependencyNode {
  id: string;
  title: string;
  date: string;
  status: string;
  kind: "completed" | "risk" | "progress" | "delayed" | "not-started";
}

const dependencyViews: DependencyView[] = ["Dependency graph", "Bottleneck analysis", "Impact simulation"];
const nodes: DependencyNode[] = [
  { id: "engineering", title: "Engineering Approval", date: "10 Oct", status: "Completed", kind: "completed" },
  { id: "po", title: "PO Release", date: "12 Oct", status: "Completed", kind: "completed" },
  { id: "delivery", title: "Material Delivery", date: "25 Oct", status: "At risk", kind: "risk" },
  { id: "installation", title: "Installation", date: "30 Oct", status: "Not started", kind: "not-started" },
  { id: "readiness", title: "Site Readiness", date: "20 Oct", status: "In progress", kind: "progress" },
  { id: "equipment", title: "Equipment Delivery", date: "22 Oct", status: "Delayed", kind: "delayed" },
];

export function DependenciesPage(): JSX.Element {
  const [view, setView] = useState<DependencyView>("Dependency graph");
  const [simulation, setSimulation] = useState("");
  const [selectedNode, setSelectedNode] = useState<DependencyNode | null>(null);

  return (
    <section className="feature-page dependencies-page">
      <header className="feature-heading">
        <div><h1>Dependencies &amp; bottleneck analysis</h1><p>Visualize task dependencies and the critical path</p></div>
        <button type="button" className="simulation-button" onClick={() => setSimulation("Simulation complete: Equipment Delivery is the current bottleneck; a 2-day slip may delay Installation.")}>Run simulation</button>
      </header>

      <div className="dependency-tabs" role="tablist" aria-label="Dependency analysis">
        {dependencyViews.map((item) => <button key={item} type="button" role="tab" aria-selected={view === item} className={view === item ? "is-selected" : ""} onClick={() => { setView(item); setSelectedNode(null); }}>{item}</button>)}
      </div>

      {simulation ? <p className="simulation-feedback" role="status">{simulation}</p> : null}

      {view === "Dependency graph" ? (
        <section className="feature-card dependency-graph-card" aria-labelledby="dependency-graph-title">
          <div className="feature-card-heading">
            <h2 id="dependency-graph-title">Alpha Expansion Plant · task dependencies</h2>
            <div className="dependency-legend"><span><i className="legend-critical" />Critical path</span><span><i className="legend-related" />Related flow</span></div>
          </div>
          <div className="dependency-graph" aria-label="Dependency graph">
            <svg className="dependency-connectors" viewBox="0 0 1000 330" preserveAspectRatio="none" aria-hidden="true">
              <defs><marker id="critical-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="#d92f27" /></marker><marker id="related-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="#8b9bb5" /></marker></defs>
              <path className="connector-critical" d="M205 82 H290 M455 82 H540 M705 82 H790" markerEnd="url(#critical-arrow)" />
              <path className="connector-related" d="M372 112 V221 H373 M622 112 V221 H623 M455 250 H540 M705 250 H872 V113" markerEnd="url(#related-arrow)" />
            </svg>
            <div className="dependency-node dependency-node--engineering"><DependencyNodeButton node={nodes[0]} onSelect={setSelectedNode} /></div>
            <div className="dependency-node dependency-node--po"><DependencyNodeButton node={nodes[1]} onSelect={setSelectedNode} /></div>
            <div className="dependency-node dependency-node--delivery"><DependencyNodeButton node={nodes[2]} onSelect={setSelectedNode} /></div>
            <div className="dependency-node dependency-node--installation"><DependencyNodeButton node={nodes[3]} onSelect={setSelectedNode} /></div>
            <div className="dependency-node dependency-node--readiness"><DependencyNodeButton node={nodes[4]} onSelect={setSelectedNode} /></div>
            <div className="dependency-node dependency-node--equipment"><DependencyNodeButton node={nodes[5]} onSelect={setSelectedNode} /></div>
          </div>
          {selectedNode ? <p className="dependency-selection" role="status"><strong>{selectedNode.title}</strong> · {selectedNode.date} · {selectedNode.status}</p> : null}
        </section>
      ) : (
        <section className="feature-card dependency-analysis-card" aria-labelledby="dependency-analysis-title">
          <div className="feature-card-heading"><div><h2 id="dependency-analysis-title">{view}</h2><p>Alpha Expansion Plant · based on current milestone links</p></div></div>
          {view === "Bottleneck analysis" ? (
            <div className="bottleneck-content"><span className="bottleneck-indicator" aria-hidden="true">!</span><div><strong>Equipment Delivery is the current bottleneck</strong><p>It gates both Installation and the critical path. Confirm the supplier date and site readiness to protect the 30 Oct installation target.</p></div></div>
          ) : (
            <div className="impact-content"><h3>Potential schedule impact</h3><p>A 2-day slip in Equipment Delivery moves the Installation milestone by 2 days. Commissioning is at risk if no recovery action is taken.</p><button type="button" className="secondary-button" onClick={() => setSimulation("Impact simulation complete: Installation shifts from 30 Oct to 1 Nov 2026.")}>Simulate 2-day delay</button></div>
          )}
        </section>
      )}

      <div className="dependency-footer-grid">
        <article className="feature-card bottleneck-summary"><h2>Bottleneck detected</h2><p>Material Delivery gates both Installation and Equipment Delivery. A slip here moves the whole critical path.</p></article>
        <article className="feature-card impact-summary"><span aria-hidden="true">✧</span><div><h2>Understand impact</h2><p>AI analyzes dependencies and predicts delay risks.</p></div></article>
      </div>
    </section>
  );
}

function DependencyNodeButton({ node, onSelect }: { node: DependencyNode; onSelect: (node: DependencyNode) => void }): JSX.Element {
  return (
    <button type="button" className={`dependency-node-button dependency-node-button--${node.kind}`} onClick={() => onSelect(node)} aria-label={`${node.title}, ${node.date}, ${node.status}`}>
      <strong>{node.title}</strong><span>{node.date} · {node.status}</span>
    </button>
  );
}
