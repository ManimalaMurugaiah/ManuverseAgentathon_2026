import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import api from "../api/client";
import { getApiErrorMessage } from "../api/errors";
import { Modal } from "../components/Modal";
import { ProgressBar, StatusPill, barTone, formatDate } from "../components/ProjectUi";
import { useAuth } from "../context/AuthContext";
import type { ApprovalWorkflow, Milestone, MilestoneList, MilestoneStatus, ProjectList, Role } from "../types";

const STATUSES: MilestoneStatus[] = ["Not Started", "In Progress", "Completed", "Delayed", "At Risk"];
const WRITE_ROLES: Role[] = ["admin", "manager", "engineering"];
// Mirrors the server-side rules so the Approve button only appears for permitted roles.
const STEP_ROLES: Record<number, Role[]> = {
  1: ["admin", "manager", "engineering"],
  2: ["admin", "manager", "engineering"],
  3: ["admin", "manager", "approver"],
};

interface MilestoneForm {
  name: string;
  owner: string;
  due_date: string;
  status: MilestoneStatus;
  progress: number;
  critical: boolean;
}

const emptyForm: MilestoneForm = { name: "", owner: "", due_date: "", status: "Not Started", progress: 0, critical: false };

function MilestoneModal({ projectId, milestone, onClose, onSaved }: Readonly<{ projectId: number; milestone: Milestone | null; onClose: () => void; onSaved: (id: number) => void }>): JSX.Element {
  const [form, setForm] = useState<MilestoneForm>(
    milestone
      ? { name: milestone.name, owner: milestone.owner ?? "", due_date: milestone.due_date ?? "", status: milestone.status, progress: milestone.progress, critical: milestone.critical }
      : emptyForm,
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const setStatus = (status: MilestoneStatus) =>
    setForm((current) => {
      if (status === "Completed") return { ...current, status, progress: 100 };
      if (status === "Not Started") return { ...current, status, progress: 0 };
      return { ...current, status, progress: current.progress === 100 ? 90 : current.progress };
    });

  const setProgress = (value: number) =>
    setForm((current) => {
      const progress = Math.min(100, Math.max(0, Number.isFinite(value) ? Math.round(value) : 0));
      let { status } = current;
      if (progress === 100) status = "Completed";
      else if (progress > 0 && status === "Not Started") status = "In Progress";
      return { ...current, progress, status };
    });

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const body = { name: form.name.trim(), owner: form.owner.trim(), due_date: form.due_date, status: form.status, progress: form.progress, critical: form.critical };
    try {
      const { data } = milestone
        ? await api.patch<Milestone>(`/milestones/${milestone.id}`, body)
        : await api.post<Milestone>(`/projects/${projectId}/milestones`, body);
      onSaved(data.id);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not save the milestone. Check the details and try again."));
      setSaving(false);
    }
  };

  return (
    <Modal eyebrow="MILESTONE" title={milestone ? "Edit milestone" : "Add milestone"} onClose={onClose}>
      <form className="feature-form" onSubmit={(event) => void submit(event)}>
        <label>
          Milestone name
          <input required minLength={2} maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <div className="form-row">
          <label>
            Owner
            <input required maxLength={100} value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
          </label>
          <label>
            Due date
            <input required type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </label>
        </div>
        <div className="form-row">
          <label>
            Status
            <select value={form.status} onChange={(e) => setStatus(e.target.value as MilestoneStatus)}>
              {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label>
            Progress (%)
            <input type="number" min={0} max={100} value={form.progress} onChange={(e) => setProgress(e.target.valueAsNumber)} />
          </label>
        </div>
        <label className="pj-check">
          <input type="checkbox" checked={form.critical} onChange={(e) => setForm({ ...form, critical: e.target.checked })} />
          Critical path milestone
        </label>
        {error ? <p className="pj-alert" role="alert">{error}</p> : null}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : milestone ? "Save changes" : "Add milestone"}</button>
        </div>
      </form>
    </Modal>
  );
}

function stepTone(status: string): string {
  if (status === "Done") return "is-done";
  if (status === "Pending") return "is-pending";
  return "";
}

function dotTone(milestone: Milestone): string {
  if (milestone.status === "Completed") return "is-done";
  if (milestone.status === "Delayed") return "is-late";
  if (milestone.status === "In Progress" || milestone.status === "At Risk") return "is-active";
  return "";
}

function MilestonesView({ projectId }: Readonly<{ projectId: number }>): JSX.Element {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role;
  const canWrite = role !== undefined && WRITE_ROLES.includes(role);

  const [data, setData] = useState<MilestoneList | null>(null);
  const [projects, setProjects] = useState<ProjectList["items"]>([]);
  const [statusFilter, setStatusFilter] = useState<MilestoneStatus | "">("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [approvals, setApprovals] = useState<ApprovalWorkflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [panelError, setPanelError] = useState("");
  const [modal, setModal] = useState<{ milestone: Milestone | null } | null>(null);
  const [evidenceName, setEvidenceName] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    api.get<ProjectList>("/projects", { params: { page_size: 50 } })
      .then(({ data: result }) => setProjects(result.items))
      .catch(() => setProjects([]));
  }, [reloadKey]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get<MilestoneList>(`/projects/${projectId}/milestones`)
      .then(({ data: result }) => {
        if (!active) return;
        setData(result);
        setError("");
        setSelectedId((current) => {
          if (current !== null && result.items.some((m) => m.id === current)) return current;
          return (result.items.find((m) => m.status !== "Completed") ?? result.items[0])?.id ?? null;
        });
      })
      .catch((err: unknown) => {
        if (active) setError(getApiErrorMessage(err, "Could not load milestones."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, reloadKey]);

  useEffect(() => {
    if (selectedId === null) {
      setApprovals(null);
      return undefined;
    }
    let active = true;
    setPanelError("");
    api.get<ApprovalWorkflow>(`/milestones/${selectedId}/approvals`)
      .then(({ data: result }) => {
        if (active) setApprovals(result);
      })
      .catch((err: unknown) => {
        if (active) setPanelError(getApiErrorMessage(err, "Could not load the approval workflow."));
      });
    return () => {
      active = false;
    };
  }, [selectedId, reloadKey]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const visible = useMemo(() => (statusFilter ? items.filter((m) => m.status === statusFilter) : items), [items, statusFilter]);
  const selected = items.find((m) => m.id === selectedId) ?? null;
  const pending = approvals?.steps.find((s) => s.status === "Pending");
  const canApprove = pending !== undefined && role !== undefined && (STEP_ROLES[pending.step_no] ?? []).includes(role);

  const act = useCallback(async (request: () => Promise<{ data: ApprovalWorkflow }>, refreshMilestones: boolean) => {
    setPanelError("");
    try {
      const { data: result } = await request();
      setApprovals(result);
      if (refreshMilestones) setReloadKey((key) => key + 1);
      return true;
    } catch (err) {
      setPanelError(getApiErrorMessage(err, "That action could not be completed."));
      return false;
    }
  }, []);

  const addEvidence = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedId === null) return;
    const ok = await act(() => api.post<ApprovalWorkflow>(`/milestones/${selectedId}/evidence`, { file_name: evidenceName.trim() }), false);
    if (ok) setEvidenceName("");
  };

  return (
    <section className="feature-page pj-page">
      <header className="feature-heading">
        <div>
          <h1>Milestones · {data?.project_name ?? "…"}</h1>
          <p>Track milestones, progress and approvals</p>
        </div>
        <div className="pj-heading-actions">
          <select className="pj-select" aria-label="Project" value={projectId} onChange={(e) => navigate(`/projects/${e.target.value}/milestones`)}>
            {projects.some((p) => p.id === projectId) ? null : <option value={projectId}>{data?.project_name ?? "Project"}</option>}
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <select className="pj-select" aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as MilestoneStatus | "")}>
            <option value="">All statuses</option>
            {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          {canWrite ? (
            <button type="button" className="primary-button pj-accent" onClick={() => setModal({ milestone: null })}>
              <span aria-hidden="true">＋</span> Add milestone
            </button>
          ) : null}
        </div>
      </header>

      {error ? <p className="pj-alert" role="alert">{error}</p> : null}

      <div className="pj-card pj-timeline-card">
        <h2>Timeline</h2>
        {items.length === 0 ? <p className="pj-state">{loading ? "Loading milestones…" : "No milestones yet."}</p> : (
          <ol className="pj-timeline">
            {items.map((milestone, index) => (
              <li key={milestone.id} className="pj-step">
                <div className="pj-step-track">
                  <span className={`pj-dot ${dotTone(milestone)}`} aria-hidden="true">{milestone.status === "Completed" ? "✓" : ""}</span>
                  {index < items.length - 1 ? <span className={`pj-line ${milestone.status === "Completed" ? "is-done" : ""}`} /> : null}
                </div>
                <strong>{milestone.name}</strong>
                <small>{formatDate(milestone.due_date)}</small>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="pj-split">
        <div className="pj-card">
          <div className="responsive-table-wrap">
            <table className="pj-table">
              <thead>
                <tr>
                  <th>Milestone</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Due date</th>
                  <th>Owner</th>
                  {canWrite ? <th><span className="pj-sr">Actions</span></th> : null}
                </tr>
              </thead>
              <tbody>
                {visible.map((milestone) => (
                  <tr key={milestone.id} className={`is-clickable ${milestone.id === selectedId ? "is-selected" : ""}`} onClick={() => setSelectedId(milestone.id)}>
                    <td>
                      <button type="button" className="pj-link-button" aria-pressed={milestone.id === selectedId} onClick={() => setSelectedId(milestone.id)}>{milestone.name}</button>
                    </td>
                    <td><StatusPill status={milestone.status} /></td>
                    <td><ProgressBar value={milestone.progress} tone={barTone(milestone.status)} /></td>
                    <td>{formatDate(milestone.due_date)}</td>
                    <td>{milestone.owner ?? "—"}</td>
                    {canWrite ? (
                      <td><button type="button" className="table-action-button" onClick={(e) => { e.stopPropagation(); setModal({ milestone }); }}>Edit</button></td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && visible.length === 0 ? <p className="pj-state">{items.length === 0 ? "No milestones yet." : "No milestones match this filter."}</p> : null}
        </div>

        <aside className="pj-card pj-approval" aria-label="Approval workflow">
          <div>
            <h2>Approval workflow</h2>
            <p className="pj-sub">{selected ? `${selected.name} · evidence required to close` : "Select a milestone to see its approvals"}</p>
          </div>
          {panelError ? <p className="pj-alert" role="alert">{panelError}</p> : null}
          {approvals ? (
            <>
              <ol className="pj-steps">
                {approvals.steps.map((step) => (
                  <li key={step.id}>
                    <span className={`pj-step-no ${stepTone(step.status)}`}>{step.step_no}</span>
                    <span className="pj-step-text">
                      <strong>{step.name}</strong>
                      <small>{step.actor ?? "—"}</small>
                    </span>
                    <span className={`pj-step-status ${stepTone(step.status)}`}>{step.status}</span>
                  </li>
                ))}
              </ol>
              {approvals.evidence.length > 0 ? (
                <ul className="pj-chips" aria-label="Evidence">
                  {approvals.evidence.map((item) => <li key={item.id} className="pj-chip" title={`Added by ${item.uploaded_by}`}>{item.file_name}</li>)}
                </ul>
              ) : null}
              {canApprove && pending ? (
                <button type="button" className="primary-button" onClick={() => void act(() => api.post<ApprovalWorkflow>(`/milestones/${approvals.milestone_id}/approvals/advance`), true)}>
                  Approve: {pending.name}
                </button>
              ) : null}
              {canWrite ? (
                <form className="pj-evidence-form" onSubmit={(event) => void addEvidence(event)}>
                  <input value={evidenceName} onChange={(e) => setEvidenceName(e.target.value)} placeholder="Evidence file name, e.g. Delivery_note.pdf" aria-label="Evidence file name" maxLength={200} required />
                  <button type="submit" className="secondary-button">Add</button>
                </form>
              ) : null}
            </>
          ) : null}
        </aside>
      </div>

      <aside className="pj-banner is-orange">
        <span className="pj-banner-icon" aria-hidden="true">⚑</span>
        <div>
          <strong>Define and track milestones</strong>
          <span>AI agents execute milestone-specific tasks.</span>
        </div>
      </aside>

      {modal ? (
        <MilestoneModal
          projectId={projectId}
          milestone={modal.milestone}
          onClose={() => setModal(null)}
          onSaved={(id) => {
            setModal(null);
            setSelectedId(id);
            setReloadKey((key) => key + 1);
          }}
        />
      ) : null}
    </section>
  );
}

export function MilestonesPage(): JSX.Element {
  const { projectId } = useParams();
  const [firstProjectId, setFirstProjectId] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    if (projectId) return undefined;
    let active = true;
    api.get<ProjectList>("/projects", { params: { page_size: 1 } })
      .then(({ data }) => {
        if (active) setFirstProjectId(data.items[0]?.id ?? null);
      })
      .catch(() => {
        if (active) setFirstProjectId(null);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  const numericId = projectId ? Number(projectId) : NaN;
  if (projectId) {
    if (!Number.isInteger(numericId) || numericId < 1) return <Navigate to="/projects" replace />;
    return <MilestonesView projectId={numericId} />;
  }

  if (firstProjectId === undefined) return <div className="centered">Loading…</div>;
  if (firstProjectId === null) {
    return (
      <section className="feature-page pj-page">
        <header className="feature-heading"><div><h1>Milestones</h1><p>Track milestones, progress and approvals</p></div></header>
        <p className="pj-state">No projects yet. <Link to="/projects">Create a project</Link> to add milestones.</p>
      </section>
    );
  }
  return <Navigate to={`/projects/${firstProjectId}/milestones`} replace />;
}
