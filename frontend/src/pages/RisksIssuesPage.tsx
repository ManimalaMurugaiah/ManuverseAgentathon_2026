import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { sampleBusinesses, sampleRisks, type SampleRisk } from "./sampleData";

type RiskFilter = "All" | "Open" | "Monitoring" | "Resolved";

const formatTimestamp = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });

export function RisksIssuesPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const requestedBusiness = searchParams.get("business") ?? "";
  const business = sampleBusinesses.includes(requestedBusiness) ? requestedBusiness : "";
  const [filter, setFilter] = useState<RiskFilter>("All");
  const [risks, setRisks] = useState(sampleRisks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const businessRisks = useMemo(
    () => risks.filter((risk) => business && risk.business === business),
    [business, risks],
  );
  const visibleRisks = businessRisks.filter((risk) => filter === "All" || risk.status === filter);
  const selectedRisk = businessRisks.find((risk) => risk.id === selectedId) ?? null;
  const openCount = businessRisks.filter((risk) => risk.status === "Open").length;
  const highCount = businessRisks.filter((risk) => risk.severity === "High" && risk.status !== "Resolved").length;

  const updateRisk = (risk: SampleRisk, status: SampleRisk["status"]) => {
    setRisks((current) => current.map((item) => item.id === risk.id ? { ...item, status } : item));
  };

  return (
    <section className="feature-page risks-page">
      <header className="feature-heading">
        <div>
          <span className="eyebrow">MANUFACTURING OPERATIONS · DEMO DATA</span>
          <h1>Risks &amp; Issues</h1>
          <p>{business ? `${business} · Spot production risks early and track the response.` : "Select a business from the top menu to view its production risks."}</p>
        </div>
      </header>

      {business ? <div className="demo-data-note"><span aria-hidden="true">ⓘ</span> Sample records for preview only. Business data can be connected to PostgreSQL later.</div> : null}

      <div className="feature-metrics">
        <article className="feature-metric"><span>Active issues</span><strong>{openCount}</strong><small>Require follow-up</small></article>
        <article className="feature-metric metric-red"><span>High severity</span><strong>{highCount}</strong><small>Across this business</small></article>
        <article className="feature-metric metric-amber"><span>Monitoring</span><strong>{businessRisks.filter((risk) => risk.status === "Monitoring").length}</strong><small>Being watched</small></article>
        <article className="feature-metric metric-green"><span>Resolved</span><strong>{businessRisks.filter((risk) => risk.status === "Resolved").length}</strong><small>Closed in demo data</small></article>
      </div>

      <div className="risk-workspace">
        <section className="feature-card risk-list-card">
          <div className="feature-card-heading">
            <div><h2>Risk register</h2><p>Select an issue to see the production line and event details.</p></div>
            <span className="record-count">{visibleRisks.length} records</span>
          </div>
          <div className="filter-tabs" role="tablist" aria-label="Filter risks">
            {(["All", "Open", "Monitoring", "Resolved"] as RiskFilter[]).map((item) => (
              <button key={item} type="button" role="tab" aria-selected={filter === item} className={filter === item ? "is-selected" : ""} onClick={() => setFilter(item)}>
                {item}<span>{item === "All" ? businessRisks.length : businessRisks.filter((risk) => risk.status === item).length}</span>
              </button>
            ))}
          </div>
          <div className="risk-list">
            {visibleRisks.map((risk) => (
              <button key={risk.id} type="button" className={`risk-list-item${selectedId === risk.id ? " is-selected" : ""}`} onClick={() => setSelectedId(risk.id)}>
                <span className={`severity-indicator severity-${risk.severity.toLowerCase()}`} aria-hidden="true" />
                <span className="risk-list-copy">
                  <span className="risk-list-top"><strong>{risk.title}</strong><span className={`status-pill status-${risk.status.toLowerCase()}`}>{risk.status}</span></span>
                  <small>{risk.id} · {risk.line} · {formatTimestamp(risk.occurredAt)}</small>
                  <span className="risk-list-description">{risk.description}</span>
                </span>
                <span className={`priority-pill priority-${risk.severity.toLowerCase()}`}>{risk.severity}</span>
              </button>
            ))}
            {visibleRisks.length === 0 ? <div className="feature-empty">No {filter.toLowerCase()} issues for this business.</div> : null}
          </div>
        </section>

        <aside className="feature-card risk-detail-card">
          {selectedRisk ? (
            <>
              <div className="risk-detail-top">
                <span className={`priority-pill priority-${selectedRisk.severity.toLowerCase()}`}>{selectedRisk.severity} severity</span>
                <span className="record-count">{selectedRisk.id}</span>
              </div>
              <h2>{selectedRisk.title}</h2>
              <p className="risk-detail-description">{selectedRisk.description}</p>
              <div className="risk-fact-grid">
                <div><span>Manufacturing line</span><strong>{selectedRisk.line}</strong></div>
                <div><span>Process / equipment</span><strong>{selectedRisk.process}</strong></div>
                <div><span>Occurred at</span><strong>{formatTimestamp(selectedRisk.occurredAt)}</strong></div>
                <div><span>Issue owner</span><strong>{selectedRisk.owner}</strong></div>
                <div className="risk-fact-wide"><span>Potential impact</span><strong>{selectedRisk.impact}</strong></div>
              </div>
              <div className="response-callout"><span>Recommended next step</span><p>{selectedRisk.response}</p></div>
              <label className="risk-status-control">
                Update issue status
                <select value={selectedRisk.status} onChange={(event) => updateRisk(selectedRisk, event.target.value as SampleRisk["status"])}>
                  <option>Open</option><option>Monitoring</option><option>Resolved</option>
                </select>
              </label>
              <p className="demo-footnote">Status changes are temporary and reset when the page is refreshed.</p>
            </>
          ) : (
            <div className="feature-empty risk-select-prompt"><span aria-hidden="true">◉</span><h2>Choose a risk to inspect</h2><p>Select an issue from the register to view its line, process, timestamp, and response details.</p></div>
          )}
        </aside>
      </div>
    </section>
  );
}
