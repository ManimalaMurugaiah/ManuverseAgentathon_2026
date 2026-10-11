import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import api from "../api/client";
import { getApiErrorMessage } from "../api/errors";
import { useApiData } from "../api/useApiData";
import { useBusiness } from "../api/useBusiness";
import { Modal } from "../components/Modal";
import { ErrorState, LoadingState, Notice } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import type { ProjectList, Risk, RiskList } from "../types";
import { formatDate } from "../components/ProjectUi";
import { formatDateTime } from "../utils/format";

const LEVELS = ["Low", "Medium", "High"] as const;
const IMPACTS = ["Low", "Medium", "High", "Critical"] as const;
const STATUSES = ["Open", "Monitoring", "Resolved"] as const;
const WRITE_ROLES = ["admin", "manager", "engineering"];

interface FormState {
  projectId: string;
  title: string;
  type: "Risk" | "Issue";
  impact: string;
  likelihood: string;
  owner: string;
  dueDate: string;
  description: string;
  mitigation: string;
}

const emptyForm = (projectId: string, owner: string): FormState => ({
  projectId, title: "", type: "Risk", impact: "Medium", likelihood: "Medium", owner, dueDate: "", description: "", mitigation: "",
});

export function RisksIssuesPage(): JSX.Element {
  const { user } = useAuth();
  const { business } = useBusiness();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project_id") ?? "";
  const canWrite = WRITE_ROLES.includes(user?.role ?? "");

  const [type, setType] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const list = useApiData<RiskList>("/risks", { project_id: projectId, business, type, severity, status });
  const everything = useApiData<RiskList>("/risks", { project_id: projectId, business });
  const projects = useApiData<ProjectList>(canWrite ? "/projects" : null, { page_size: 100, business });

  const [selected, setSelected] = useState<Risk | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm("", ""));
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"ok" | "error">("ok");

  const items = list.data?.items ?? [];
  const all = everything.data?.items ?? [];
  const reload = () => { list.reload(); everything.reload(); };
  const tell = (message: string, tone: "ok" | "error" = "ok") => { setNotice(message); setNoticeTone(tone); };

  const matrix = useMemo(() => {
    const counts = new Map<string, number>();
    all.filter((risk) => risk.status !== "Resolved").forEach((risk) => {
      const impact = risk.impact === "Critical" ? "High" : risk.impact;
      const key = `${risk.likelihood}|${impact}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [all]);

  const advice = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const open = all.filter((risk) => risk.status !== "Resolved");
    const lines: string[] = [];
    open.filter((risk) => risk.severity === "High").slice(0, 3).forEach((risk) => {
      lines.push(risk.mitigation ? `Review "${risk.title}" with ${risk.owner ?? "its owner"}: ${risk.mitigation}` : `Agree a mitigation for "${risk.title}" (High severity, no plan recorded).`);
    });
    open.filter((risk) => risk.due_date && risk.due_date < today).slice(0, 2).forEach((risk) => {
      lines.push(`"${risk.title}" is past its due date of ${formatDate(risk.due_date)}. Confirm a new date or close it.`);
    });
    return lines;
  }, [all]);

  const openCreate = () => {
    setForm(emptyForm(projectId || (projects.data?.items[0] ? String(projects.data.items[0].id) : ""), user?.username ?? ""));
    setFormError("");
    setShowCreate(true);
  };

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.projectId) { setFormError("Choose the project this belongs to."); return; }
    setSaving(true);
    setFormError("");
    try {
      await api.post("/risks", {
        project_id: Number(form.projectId), title: form.title.trim(), risk_type: form.type, impact: form.impact,
        likelihood: form.likelihood, owner: form.owner.trim(), due_date: form.dueDate || null,
        description: form.description.trim() || null, mitigation: form.mitigation.trim() || null,
      });
      setShowCreate(false);
      setType(""); setSeverity(""); setStatus("");
      tell("Risk or issue added.");
      reload();
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Could not save this risk or issue."));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (risk: Risk, next: string) => {
    try {
      const { data } = await api.patch<Risk>(`/risks/${risk.id}`, { status: next });
      setSelected(data);
      reload();
    } catch (error) {
      tell(getApiErrorMessage(error, "Could not update the status."), "error");
    }
  };

  const matrixCount = (likelihood: string, impact: string) => matrix.get(`${likelihood}|${impact}`) ?? 0;
  const scope = business || (projectId ? "Selected project" : "");

  return (
    <section className="feature-page risks-page screenshot-register-page">
      <header className="feature-heading">
        <div><h1>Risks &amp; issues</h1><p>Manage risks, issues and mitigation actions{scope ? ` · ${scope}` : ""}</p></div>
        {canWrite ? <button type="button" className="risk-add-button" disabled={!projects.data} onClick={openCreate}>＋ Add risk / issue</button> : null}
      </header>
      <div className="risk-filters" aria-label="Risk filters">
        <label><span className="visually-hidden">Filter by type</span><select aria-label="Filter by type" value={type} onChange={(event) => setType(event.target.value)}><option value="">All types</option><option>Risk</option><option>Issue</option></select></label>
        <label><span className="visually-hidden">Filter by severity</span><select aria-label="Filter by severity" value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="">All severity</option>{[...LEVELS].reverse().map((level) => <option key={level}>{level}</option>)}</select></label>
        <label><span className="visually-hidden">Filter by status</span><select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All status</option>{STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      <Notice message={notice} tone={noticeTone} />
      {list.error ? <ErrorState message={list.error} onRetry={reload} /> : null}

      <div className="risk-register-grid">
        <section className="feature-card risk-register-card" aria-label="Risk and issue register">
          {list.loading && !list.data ? <LoadingState /> : (
            <div className="responsive-table-wrap">
              <table className="feature-table risk-register-table" aria-label="Risk and issue register">
                <thead><tr><th>Type</th><th>Title</th><th>Project</th><th>Severity</th><th>Status</th><th>Owner</th><th>Due date</th></tr></thead>
                <tbody>
                  {items.map((risk) => (
                    <tr key={risk.id}>
                      <td><span className={`risk-type-pill risk-type--${risk.risk_type.toLowerCase()}`}>{risk.risk_type}</span></td>
                      <td><button type="button" className="table-title-button" onClick={() => setSelected(risk)}>{risk.title}</button></td>
                      <td>{risk.project_name ?? "—"}</td>
                      <td><span className={`priority-pill priority-${risk.severity.toLowerCase()}`}>{risk.severity}</span></td>
                      <td><span className={`status-pill status-${risk.status.toLowerCase()}`}>{risk.status}</span></td>
                      <td>{risk.owner ?? "—"}</td><td>{formatDate(risk.due_date)}</td>
                    </tr>
                  ))}
                  {list.data && !items.length ? <tr><td colSpan={7} className="table-empty">{type || severity || status ? "No risks or issues match the selected filters." : "No risks or issues have been recorded yet."}</td></tr> : null}
                </tbody>
              </table>
            </div>
          )}
          <div className="table-footer">Showing {items.length} of {list.data?.total ?? 0} risks and issues</div>
        </section>

        <aside className="feature-card risk-matrix-card">
          <div className="feature-card-heading"><div><h2>Risk matrix</h2><p>Likelihood × impact · open items</p></div></div>
          <div className="risk-matrix-grid" role="grid" aria-label="Open risk matrix">
            <span className="matrix-corner" aria-hidden="true" />
            {LEVELS.map((level) => <span key={`column-${level}`} className="matrix-column-label">{level}</span>)}
            {[...LEVELS].reverse().map((likelihood) => (
              <div className="matrix-row" role="row" key={likelihood}>
                <span className="matrix-row-label">{likelihood === "Medium" ? "Med" : likelihood}</span>
                {LEVELS.map((impact) => {
                  const count = matrixCount(likelihood, impact);
                  const level = LEVELS.indexOf(likelihood) + LEVELS.indexOf(impact);
                  return <span key={`${likelihood}-${impact}`} role="gridcell" aria-label={`${likelihood} likelihood, ${impact} impact: ${count} open items`} className={`matrix-cell matrix-cell--${level < 2 ? "low" : level < 4 ? "medium" : "high"}`}>{count || ""}</span>;
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
        <span><strong>Proactively manage risks</strong><small>Suggestions are based on your open items and due dates.</small></span>
        <button type="button" onClick={() => setSuggestions((visible) => !visible)}>{suggestions ? "Hide suggestions" : "View suggestions"}</button>
      </aside>
      {suggestions ? (
        <div className="risk-suggestion-panel" role="region" aria-label="Risk mitigation suggestions">
          <strong>Recommended next steps</strong>
          {advice.length ? <ul>{advice.map((line) => <li key={line}>{line}</li>)}</ul> : <p className="pl-muted">Nothing needs attention right now. No high-severity or overdue items are open.</p>}
        </div>
      ) : null}

      {showCreate ? (
        <Modal eyebrow="RISK REGISTER" title="Add risk or issue" onClose={() => setShowCreate(false)}>
          <form className="feature-form" onSubmit={(event) => void create(event)}>
            <label>Project
              <select required value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })}>
                <option value="">Select project</option>
                {(projects.data?.items ?? []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
            <label>Title<input required minLength={2} maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
            <div className="form-row">
              <label>Type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as "Risk" | "Issue" })}><option>Risk</option><option>Issue</option></select></label>
              <label>Owner<input required maxLength={100} value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} /></label>
            </div>
            <div className="form-row">
              <label>Likelihood<select value={form.likelihood} onChange={(event) => setForm({ ...form, likelihood: event.target.value })}>{LEVELS.map((level) => <option key={level}>{level}</option>)}</select></label>
              <label>Impact<select value={form.impact} onChange={(event) => setForm({ ...form, impact: event.target.value })}>{IMPACTS.map((level) => <option key={level}>{level}</option>)}</select></label>
            </div>
            <label>Due date<input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label>
            <label>Description<textarea rows={3} maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
            <label>Mitigation / next step<textarea rows={3} maxLength={1000} value={form.mitigation} onChange={(event) => setForm({ ...form, mitigation: event.target.value })} /></label>
            <p className="pl-muted">Severity is calculated from likelihood and impact.</p>
            {formError ? <p className="wiz-error" role="alert">{formError}</p> : null}
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" className="risk-add-button" disabled={saving}>{saving ? "Saving…" : "Add risk / issue"}</button></div>
          </form>
        </Modal>
      ) : null}

      {selected ? (
        <Modal eyebrow={`${selected.severity} severity · RSK-${selected.id}`} title={selected.title} onClose={() => setSelected(null)}>
          <p className="modal-description">{selected.description ?? "No description recorded."}</p>
          <div className="risk-fact-grid">
            <div><span>Project</span><strong>{selected.project_name ?? "—"}</strong></div>
            <div><span>Owner</span><strong>{selected.owner ?? "—"}</strong></div>
            <div><span>Likelihood / impact</span><strong>{selected.likelihood ?? "—"} / {selected.impact ?? "—"}</strong></div>
            <div><span>Due date</span><strong>{formatDate(selected.due_date)}</strong></div>
            <div className="risk-fact-wide"><span>Recorded</span><strong>{formatDateTime(selected.created_at)}</strong></div>
          </div>
          <div className="response-callout"><span>Recommended next step</span><p>{selected.mitigation ?? "No mitigation has been recorded yet."}</p></div>
          {canWrite ? (
            <label className="risk-status-control">Update status
              <select value={selected.status} onChange={(event) => void changeStatus(selected, event.target.value)}>{STATUSES.map((item) => <option key={item}>{item}</option>)}</select>
            </label>
          ) : null}
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setSelected(null)}>Close</button></div>
        </Modal>
      ) : null}
    </section>
  );
}
