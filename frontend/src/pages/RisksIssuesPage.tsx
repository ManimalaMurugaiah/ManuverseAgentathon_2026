import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { sampleBusinesses, sampleRisks, type SampleRisk } from "./sampleData";

type RiskFilterState = { type: "All" | "Risk" | "Issue"; severity: "All" | "High" | "Medium" | "Low"; status: "All" | SampleRisk["status"] };

const formatTimestamp = (value: string) => new Date(value).toLocaleString(undefined, {
  month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
});
const formatDueDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", {
  day: "numeric", month: "short", year: "numeric",
});
const levels = ["Low", "Medium", "High"] as const;

export function RisksIssuesPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const requestedBusiness = searchParams.get("business") ?? "";
  const business = sampleBusinesses.includes(requestedBusiness) ? requestedBusiness : "";
  const [risks, setRisks] = useState(sampleRisks);
  const [filters, setFilters] = useState<RiskFilterState>({ type: "All", severity: "All", status: "All" });
  const [selectedRisk, setSelectedRisk] = useState<SampleRisk | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newSeverity, setNewSeverity] = useState<SampleRisk["severity"]>("Medium");
  const [newType, setNewType] = useState<SampleRisk["type"]>("Risk");
  const [newLikelihood, setNewLikelihood] = useState<SampleRisk["likelihood"]>("Medium");
  const [newImpactLevel, setNewImpactLevel] = useState<SampleRisk["impactLevel"]>("Medium");

  const businessRisks = useMemo(
    () => risks.filter((risk) => !business || risk.business === business),
    [business, risks],
  );
  const visibleRisks = businessRisks.filter((risk) =>
    (filters.type === "All" || risk.type === filters.type)
    && (filters.severity === "All" || risk.severity === filters.severity)
    && (filters.status === "All" || risk.status === filters.status),
  );

  const changeStatus = (risk: SampleRisk, status: SampleRisk["status"]) => {
    setRisks((items) => items.map((item) => item.id === risk.id ? { ...item, status } : item));
    setSelectedRisk((current) => current?.id === risk.id ? { ...current, status } : current);
  };

  const addRisk = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const risk: SampleRisk = {
      id: `RSK-${String(Date.now()).slice(-4)}`,
      business: business || sampleBusinesses[0],
      type: newType,
      title: newTitle.trim(),
      description: "New demo record. Add full production context when connecting live project data.",
      severity: newSeverity,
      likelihood: newLikelihood,
      impactLevel: newImpactLevel,
      status: "Open",
      line: "Unassigned line",
      process: "Production review",
      occurredAt: new Date().toISOString(),
      dueDate: newDueDate,
      owner: newOwner.trim(),
      impact: "Impact assessment required",
      response: "Review the issue and assign a mitigation action.",
    };
    setRisks((items) => [risk, ...items]);
    setFilters({ type: "All", severity: "All", status: "All" });
    setShowCreate(false);
    setNewTitle("");
    setNewOwner("");
    setNewDueDate("");
    setNewLikelihood("Medium");
    setNewImpactLevel("Medium");
    setFeedback("Risk or issue added.");
  };

  const matrixCount = (likelihood: string, impact: string) => businessRisks.filter(
    (risk) => risk.likelihood === likelihood && risk.impactLevel === impact && risk.status !== "Resolved",
  ).length;

  return (
    <section className="feature-page risks-page screenshot-register-page">
      <header className="feature-heading">
        <div><h1>Risks &amp; issues</h1><p>Manage risks, issues and mitigation actions{business ? ` · ${business}` : ""}</p></div>
        <button type="button" className="risk-add-button" onClick={() => { setFeedback(""); setShowCreate(true); }}>＋ Add risk / issue</button>
      </header>
      <div className="risk-filters" aria-label="Risk filters">
        <label><span className="visually-hidden">Filter by type</span><select aria-label="Filter by type" value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value as RiskFilterState["type"] }))}><option value="All">All types</option><option>Risk</option><option>Issue</option></select></label>
        <label><span className="visually-hidden">Filter by severity</span><select aria-label="Filter by severity" value={filters.severity} onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value as RiskFilterState["severity"] }))}><option value="All">All severity</option>{levels.slice().reverse().map((level) => <option key={level}>{level}</option>)}</select></label>
        <label><span className="visually-hidden">Filter by status</span><select aria-label="Filter by status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as RiskFilterState["status"] }))}><option value="All">All status</option><option>Open</option><option>Monitoring</option><option>Resolved</option></select></label>
      </div>
      {feedback ? <p role="status" className="screen-feedback">{feedback}</p> : null}

      <div className="risk-register-grid">
        <section className="feature-card risk-register-card" aria-label="Risk and issue register">
          <div className="responsive-table-wrap">
            <table className="feature-table risk-register-table" aria-label="Risk and issue register">
              <thead><tr><th>Type</th><th>Title</th><th>Severity</th><th>Status</th><th>Owner</th><th>Due date</th></tr></thead>
              <tbody>
                {visibleRisks.map((risk) => (
                  <tr key={risk.id}>
                    <td><span className={`risk-type-pill risk-type--${risk.type.toLowerCase()}`}>{risk.type}</span></td>
                    <td><button type="button" className="table-title-button" onClick={() => setSelectedRisk(risk)}>{risk.title}</button></td>
                    <td><span className={`priority-pill priority-${risk.severity.toLowerCase()}`}>{risk.severity}</span></td>
                    <td><span className={`status-pill status-${risk.status.toLowerCase()}`}>{risk.status}</span></td>
                    <td>{risk.owner}</td><td>{formatDueDate(risk.dueDate)}</td>
                  </tr>
                ))}
                {!visibleRisks.length ? <tr><td colSpan={6} className="table-empty">No risks or issues match the selected filters.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="table-footer">Showing {visibleRisks.length} of {businessRisks.length} risks and issues</div>
        </section>

        <aside className="feature-card risk-matrix-card">
          <div className="feature-card-heading"><div><h2>Risk matrix</h2><p>Likelihood × impact · open items</p></div></div>
          <div className="risk-matrix-grid" role="grid" aria-label="Open risk matrix">
            <span className="matrix-corner" aria-hidden="true" />
            {levels.map((likelihood) => <span key={`column-${likelihood}`} className="matrix-column-label">{likelihood}</span>)}
            {levels.slice().reverse().map((likelihood) => (
              <div className="matrix-row" role="row" key={likelihood}>
                <span className="matrix-row-label">{likelihood === "Medium" ? "Med" : likelihood}</span>
                {levels.map((impact) => {
                  const count = matrixCount(likelihood, impact);
                  const riskLevel = levels.indexOf(likelihood) + levels.indexOf(impact);
                  return <span key={`${likelihood}-${impact}`} role="gridcell" aria-label={`${likelihood} likelihood, ${impact} impact: ${count} open items`} className={`matrix-cell matrix-cell--${riskLevel < 2 ? "low" : riskLevel < 4 ? "medium" : "high"}`}>{count || ""}</span>;
                })}
              </div>
            ))}
            <span className="matrix-axis-label">Low</span><span className="matrix-axis-label">Med</span><span className="matrix-axis-label">High</span>
            <span className="matrix-impact-label">Impact →</span>
          </div>
        </aside>
      </div>

      <aside className="risk-suggestions-callout">
        <span className="risk-suggestions-icon" aria-hidden="true">⚠</span>
        <span><strong>Proactively manage risks</strong><small>AI identifies and suggests mitigation based on project data.</small></span>
        <button type="button" onClick={() => setSuggestionsVisible((visible) => !visible)}>{suggestionsVisible ? "Hide suggestions" : "View suggestions"}</button>
      </aside>
      {suggestionsVisible ? <div className="risk-suggestion-panel" role="region" aria-label="Risk mitigation suggestions"><strong>Recommended next steps</strong><ul><li>Review high-severity open items with their owners.</li><li>Confirm mitigation dates for risks affecting the critical path.</li></ul></div> : null}

      {showCreate ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreate(false); }}>
          <section className="feature-modal" role="dialog" aria-modal="true" aria-labelledby="add-risk-title">
            <div className="modal-heading"><div><span className="eyebrow">RISK REGISTER</span><h2 id="add-risk-title">Add risk or issue</h2></div><button type="button" className="modal-close" aria-label="Close add risk form" onClick={() => setShowCreate(false)}>×</button></div>
            <form className="feature-form" onSubmit={addRisk}>
              <label>Title<input required maxLength={120} value={newTitle} onChange={(event) => setNewTitle(event.target.value)} /></label>
              <div className="form-row"><label>Type<select value={newType} onChange={(event) => setNewType(event.target.value as SampleRisk["type"])}><option>Risk</option><option>Issue</option></select></label><label>Severity<select value={newSeverity} onChange={(event) => setNewSeverity(event.target.value as SampleRisk["severity"])}><option>High</option><option>Medium</option><option>Low</option></select></label></div>
              <div className="form-row"><label>Owner<input required maxLength={60} value={newOwner} onChange={(event) => setNewOwner(event.target.value)} /></label><label>Due date<input required type="date" value={newDueDate} onChange={(event) => setNewDueDate(event.target.value)} /></label></div>
              <div className="form-row"><label>Likelihood<select value={newLikelihood} onChange={(event) => setNewLikelihood(event.target.value as SampleRisk["likelihood"])}><option>High</option><option>Medium</option><option>Low</option></select></label><label>Impact<select value={newImpactLevel} onChange={(event) => setNewImpactLevel(event.target.value as SampleRisk["impactLevel"])}><option>High</option><option>Medium</option><option>Low</option></select></label></div>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" className="risk-add-button">Add risk / issue</button></div>
            </form>
          </section>
        </div>
      ) : null}

      {selectedRisk ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRisk(null); }}>
          <section className="feature-modal" role="dialog" aria-modal="true" aria-labelledby="risk-detail-title">
            <div className="modal-heading"><div><span className={`priority-pill priority-${selectedRisk.severity.toLowerCase()}`}>{selectedRisk.severity} severity · {selectedRisk.id}</span><h2 id="risk-detail-title">{selectedRisk.title}</h2></div><button type="button" className="modal-close" aria-label="Close risk details" onClick={() => setSelectedRisk(null)}>×</button></div>
            <p className="modal-description">{selectedRisk.description}</p>
            <div className="risk-fact-grid"><div><span>Manufacturing line</span><strong>{selectedRisk.line}</strong></div><div><span>Process / equipment</span><strong>{selectedRisk.process}</strong></div><div><span>Occurred at</span><strong>{formatTimestamp(selectedRisk.occurredAt)}</strong></div><div><span>Issue owner</span><strong>{selectedRisk.owner}</strong></div><div className="risk-fact-wide"><span>Potential impact</span><strong>{selectedRisk.impact}</strong></div></div>
            <div className="response-callout"><span>Recommended next step</span><p>{selectedRisk.response}</p></div>
            <label className="risk-status-control">Update issue status<select value={selectedRisk.status} onChange={(event) => changeStatus(selectedRisk, event.target.value as SampleRisk["status"])}><option>Open</option><option>Monitoring</option><option>Resolved</option></select></label>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setSelectedRisk(null)}>Close</button></div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
