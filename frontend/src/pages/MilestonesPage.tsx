import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import api from "../api/client";
import { getApiErrorMessage } from "../api/errors";
import { useApiData } from "../api/useApiData";
import { useBusiness } from "../api/useBusiness";
import { Modal } from "../components/Modal";
import { ErrorState, LoadingState, Notice, Pill, ProgressBar, scheduleTone } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import type { ApprovalWorkflow, Milestone, MilestoneList, MilestoneStatus, ProjectList } from "../types";
import { formatDate } from "../components/ProjectUi";

const STATUSES: MilestoneStatus[] = ["Not Started", "In Progress", "Completed", "Delayed", "At Risk"];
const WRITE_ROLES = ["admin", "manager", "engineering"];
// Roles allowed to approve each workflow step; step 4 is closed by the system.
const STEP_ROLES: Record<number, string[]> = {
  1: ["admin", "manager", "engineering"],
  2: ["admin", "manager", "engineering"],
  3: ["admin", "manager", "approver"],
};
const EVIDENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,150}\.(pdf|png|jpe?g|zip|docx?|xlsx?|txt)$/i;

interface FormState {
  name: string;
  owner: string;
  dueDate: string;
  forecastDate: string;
  status: MilestoneStatus;
  progress: string;
  critical: boolean;
}

const emptyForm = (owner: string): FormState => ({ name: "", owner, dueDate: "", forecastDate: "", status: "Not Started", progress: "0", critical: false });

function fromMilestone(milestone: Milestone): FormState {
  return {
    name: milestone.name,
    owner: milestone.owner ?? "",
    dueDate: milestone.due_date ?? "",
    forecastDate: milestone.forecast_date ?? "",
    status: milestone.status,
    progress: String(milestone.progress),
    critical: milestone.critical,
  };
}

export function MilestonesPage(): JSX.Element {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { business, withBusiness } = useBusiness();
  const role = user?.role ?? "viewer";
  const canWrite = WRITE_ROLES.includes(role);

  const projects = useApiData<ProjectList>("/projects", { page_size: 100, business });
  const requested = projectId ?? searchParams.get("project_id") ?? "";
  const activeId = requested || (projects.data?.items[0] ? String(projects.data.items[0].id) : "");

  const [statusFilter, setStatusFilter] = useState("");
  const milestones = useApiData<MilestoneList>(activeId ? `/projects/${activeId}/milestones` : null, { status: statusFilter });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formFor, setFormFor] = useState<{ milestone: Milestone | null } | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(""));
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"ok" | "error">("ok");
  const [approval, setApproval] = useState<ApprovalWorkflow | null>(null);
  const [approvalError, setApprovalError] = useState("");
  const [evidenceName, setEvidenceName] = useState("");

  const items = useMemo(() => milestones.data?.items ?? [], [milestones.data]);
  const current = useMemo(
    () => items.find((item) => item.id === selectedId)
      ?? items.find((item) => item.status === "In Progress")
      ?? items.find((item) => item.status !== "Completed")
      ?? items[0],
    [items, selectedId],
  );
  const currentId = current?.id;

  useEffect(() => {
    setSelectedId(null);
  }, [activeId]);

  useEffect(() => {
    if (!currentId) {
      setApproval(null);
      return undefined;
    }
    let active = true;
    setApprovalError("");
    api.get<ApprovalWorkflow>(`/milestones/${currentId}/approvals`)
      .then(({ data }) => { if (active) setApproval(data); })
      .catch((error: unknown) => { if (active) setApprovalError(getApiErrorMessage(error, "Could not load the approval workflow.")); });
    return () => { active = false; };
  }, [currentId]);

  const tell = (message: string, tone: "ok" | "error" = "ok") => {
    setNotice(message);
    setNoticeTone(tone);
  };

  const openForm = (milestone: Milestone | null) => {
    setForm(milestone ? fromMilestone(milestone) : emptyForm(user?.username ?? ""));
    setFormError("");
    setFormFor({ milestone });
  };

  const saveMilestone = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formFor) return;
    const progress = Number(form.progress);
    if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
      setFormError("Progress must be a whole number from 0 to 100.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      if (formFor.milestone) {
        await api.patch(`/milestones/${formFor.milestone.id}`, {
          name: form.name.trim(), owner: form.owner.trim(), due_date: form.dueDate,
          forecast_date: form.forecastDate || null, status: form.status, progress, critical: form.critical,
        });
        tell("Milestone updated.");
      } else {
        await api.post(`/projects/${activeId}/milestones`, {
          name: form.name.trim(), owner: form.owner.trim(), due_date: form.dueDate,
          status: form.status, progress, critical: form.critical,
        });
        tell("Milestone added.");
      }
      setFormFor(null);
      milestones.reload();
      projects.reload();
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Could not save this milestone."));
    } finally {
      setSaving(false);
    }
  };

  const advance = async () => {
    if (!currentId) return;
    setApprovalError("");
    try {
      const { data } = await api.post<ApprovalWorkflow>(`/milestones/${currentId}/approvals/advance`);
      setApproval(data);
      tell("Approval recorded.");
      milestones.reload();
    } catch (error) {
      setApprovalError(getApiErrorMessage(error, "Could not record this approval."));
    }
  };

  const addEvidence = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentId) return;
    const name = evidenceName.trim();
    if (!EVIDENCE_PATTERN.test(name)) {
      setApprovalError("Use a file name ending in pdf, png, jpg, zip, doc(x), xls(x) or txt.");
      return;
    }
    setApprovalError("");
    try {
      const { data } = await api.post<ApprovalWorkflow>(`/milestones/${currentId}/evidence`, { file_name: name });
      setApproval(data);
      setEvidenceName("");
    } catch (error) {
      setApprovalError(getApiErrorMessage(error, "Could not add this evidence."));
    }
  };

  const selectProject = (value: string) => navigate(withBusiness(`/projects/${value}/milestones`));
  const projectName = milestones.data?.project_name ?? projects.data?.items.find((p) => String(p.id) === activeId)?.name ?? "";
  const pending = approval?.steps.find((step) => step.status === "Pending");
  const canApprove = Boolean(pending && (STEP_ROLES[pending.step_no] ?? []).includes(role));

  if (projects.loading && !projects.data) return <section className="feature-page milestone-page"><LoadingState label="Loading milestones…" /></section>;
  if (!activeId) {
    return (
      <section className="feature-page milestone-page">
        <header className="feature-heading"><div><h1>Milestones</h1><p>Track milestones, progress and approvals</p></div></header>
        {projects.error ? <ErrorState message={projects.error} onRetry={projects.reload} /> : <p className="pl-state">No projects yet. Create a project to start tracking milestones.</p>}
      </section>
    );
  }

  return (
    <section className="feature-page milestone-page">
      <header className="feature-heading">
        <div><h1>Milestones · {projectName || "…"}</h1><p>Track milestones, progress and approvals</p></div>
        <div className="milestone-heading-actions">
          <label className="visually-hidden" htmlFor="milestone-project">Project</label>
          <select id="milestone-project" aria-label="Project" value={activeId} onChange={(event) => selectProject(event.target.value)}>
            {(projects.data?.items ?? []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <label className="visually-hidden" htmlFor="milestone-status">Filter by status</label>
          <select id="milestone-status" aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
          {canWrite ? <button type="button" className="milestone-add-button" onClick={() => openForm(null)}>＋ Add milestone</button> : null}
        </div>
      </header>
      <Notice message={notice} tone={noticeTone} />
      {milestones.error ? <ErrorState message={milestones.error} onRetry={milestones.reload} /> : null}

      <section className="feature-card milestone-timeline-card" aria-labelledby="milestone-timeline-title">
        <h2 id="milestone-timeline-title">Timeline</h2>
        {milestones.loading && !milestones.data ? <LoadingState /> : null}
        {milestones.data && !items.length ? <p className="pl-muted">{statusFilter ? "No milestones have this status." : "This project has no milestones yet."}</p> : null}
        <ol className="milestone-timeline">
          {items.map((milestone) => (
            <li key={milestone.id} className={`timeline-stop timeline-stop--${milestone.status.toLowerCase().replace(" ", "-")}`}>
              <span className="timeline-stop-marker" aria-hidden="true">{milestone.status === "Completed" ? "✓" : ""}</span>
              <strong>{milestone.name}</strong>
              <small>{formatDate(milestone.due_date)}</small>
            </li>
          ))}
        </ol>
      </section>

      <div className="milestone-content-grid">
        <section className="feature-card milestone-table-card" aria-label="Milestone register">
          <div className="responsive-table-wrap">
            <table className="feature-table milestone-table" aria-label="Milestone register">
              <thead><tr><th>Milestone</th><th>Status</th><th>Progress</th><th>Due date</th><th>Owner</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
              <tbody>
                {items.map((milestone) => (
                  <tr key={milestone.id} className={milestone.id === currentId ? "is-selected" : ""} onClick={() => setSelectedId(milestone.id)} aria-selected={milestone.id === currentId}>
                    <td><button type="button" className="table-title-button" aria-pressed={milestone.id === currentId} onClick={() => setSelectedId(milestone.id)}>{milestone.name}</button>{milestone.critical ? <span className="pl-critical" title="Critical path"> ⚑</span> : null}</td>
                    <td><Pill value={milestone.status} /></td>
                    <td><ProgressBar value={milestone.progress} tone={scheduleTone(milestone.status)} /></td>
                    <td>{formatDate(milestone.due_date)}</td>
                    <td>{milestone.owner ?? "—"}</td>
                    <td onClick={(event) => event.stopPropagation()}>
                      {canWrite ? <button type="button" className="table-action-button" aria-label={`Edit ${milestone.name}`} onClick={() => openForm(milestone)}>Edit</button> : null}
                    </td>
                  </tr>
                ))}
                {milestones.data && !items.length ? <tr><td colSpan={6} className="table-empty">No milestones to show.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="feature-card approval-card" aria-label="Approval workflow">
          <h2>Approval workflow</h2>
          <p>{approval?.milestone_name ?? current?.name ?? "Milestone"} · evidence required to close</p>
          {approvalError ? <p className="wiz-error" role="alert">{approvalError}</p> : null}
          {approval ? (
            <ol className="approval-steps">
              {approval.steps.map((step) => (
                <li key={step.id} className={`approval-step approval-step--${step.status.toLowerCase()}`}>
                  <span className="approval-step-number">{step.status === "Done" ? "✓" : step.step_no}</span>
                  <span className="approval-step-copy"><strong>{step.name}</strong><small>{step.actor ?? "—"}</small></span>
                  {step.status === "Pending" && canApprove
                    ? <button type="button" className="approval-status approval-status--pending" aria-label={`Approve: ${step.name}`} onClick={() => void advance()}>Approve</button>
                    : <span className={`approval-status approval-status--${step.status.toLowerCase()}`}>{step.status}</span>}
                </li>
              ))}
            </ol>
          ) : <LoadingState />}
          <div className="milestone-attachments" aria-label="Milestone evidence">
            {(approval?.evidence ?? []).map((file) => <span key={file.id} title={`Added by ${file.uploaded_by}`}>{file.file_name}</span>)}
            {approval && !approval.evidence.length ? <small className="pl-muted">No evidence yet.</small> : null}
          </div>
          {canWrite && approval ? (
            <form className="pl-evidence-form" onSubmit={(event) => void addEvidence(event)}>
              <input aria-label="Evidence file name" value={evidenceName} maxLength={150} placeholder="e.g. Delivery_note.pdf" onChange={(event) => setEvidenceName(event.target.value)} />
              <button type="submit" className="secondary-button" disabled={!evidenceName.trim()}>Add evidence</button>
            </form>
          ) : null}
        </aside>
      </div>

      {formFor ? (
        <Modal eyebrow="MILESTONE REGISTER" title={formFor.milestone ? "Edit milestone" : "Add milestone"} onClose={() => setFormFor(null)}>
          <form className="feature-form" onSubmit={(event) => void saveMilestone(event)}>
            <label>Milestone name<input required minLength={2} maxLength={200} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <div className="form-row">
              <label>Due date<input required type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label>
              <label>Owner<input required maxLength={100} value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} /></label>
            </div>
            <div className="form-row">
              <label>Status
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as MilestoneStatus, progress: event.target.value === "Completed" ? "100" : form.progress })}>
                  {STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <label>Progress (%)<input type="number" min={0} max={100} step={1} disabled={form.status === "Completed"} value={form.progress} onChange={(event) => setForm({ ...form, progress: event.target.value })} /></label>
            </div>
            {formFor.milestone ? <label>Forecast date<input type="date" value={form.forecastDate} onChange={(event) => setForm({ ...form, forecastDate: event.target.value })} /></label> : null}
            <label className="pl-check"><input type="checkbox" checked={form.critical} onChange={(event) => setForm({ ...form, critical: event.target.checked })} /> Critical path milestone</label>
            {formError ? <p className="wiz-error" role="alert">{formError}</p> : null}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setFormFor(null)}>Cancel</button>
              <button type="submit" className="milestone-add-button" disabled={saving}>{saving ? "Saving…" : formFor.milestone ? "Save changes" : "Add milestone"}</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
