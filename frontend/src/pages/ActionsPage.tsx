import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import api from "../api/client";
import { getApiErrorMessage } from "../api/errors";
import { useApiData } from "../api/useApiData";
import { useBusiness } from "../api/useBusiness";
import { Field, FormDrawer } from "../components/FormDrawer";
import { Modal } from "../components/Modal";
import { ErrorState, LoadingState, Notice } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import type { Action, ActionList, MilestoneList, ProjectList } from "../types";
import { formatDate } from "../components/ProjectUi";

type View = "My Actions" | "All Actions";

const WRITE_ROLES = ["admin", "manager", "engineering", "approver"];
const APPROVER_ROLES = ["admin", "manager", "approver"];
const STATUS_FILTERS = ["Open", "Assigned", "In Progress", "Overdue", "Closed", "Verified"];
const CLOSED = ["Closed", "Verified"];

interface FormState {
  projectId: string;
  title: string;
  description: string;
  owner: string;
  dueDate: string;
  priority: "High" | "Medium" | "Low";
  actionType: "Approval" | "Task";
  runBy: "AI agent" | "Manual";
  milestoneId: string;
}

const emptyForm = (projectId: string, owner: string): FormState => ({
  projectId, title: "", description: "", owner, dueDate: "", priority: "Medium", actionType: "Task", runBy: "Manual", milestoneId: "",
});

export function ActionsPage(): JSX.Element {
  const { user } = useAuth();
  const { business } = useBusiness();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project_id") ?? "";
  const role = user?.role ?? "viewer";
  const canWrite = WRITE_ROLES.includes(role);
  const canApprove = APPROVER_ROLES.includes(role);

  const [view, setView] = useState<View>("My Actions");
  const [status, setStatus] = useState("");
  const [runBy, setRunBy] = useState("");
  const list = useApiData<ActionList>("/actions", { project_id: projectId, business, status, run_by: runBy, mine: view === "My Actions" });
  const projects = useApiData<ProjectList>(canWrite ? "/projects" : null, { page_size: 100, business });

  const [selected, setSelected] = useState<Action | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Action | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm("", ""));
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"ok" | "error">("ok");
  const milestones = useApiData<MilestoneList>(showCreate && form.projectId ? `/projects/${form.projectId}/milestones` : null);

  const tell = (message: string, tone: "ok" | "error" = "ok") => { setNotice(message); setNoticeTone(tone); };
  const items = list.data?.items ?? [];

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(projectId || (projects.data?.items[0] ? String(projects.data.items[0].id) : ""), user?.username ?? ""));
    setFormError("");
    setShowCreate(true);
  };

  const openEdit = (action: Action) => {
    setEditing(action);
    setSelected(null);
    setForm({
      projectId: String(action.project_id ?? ""), title: action.title, description: action.description ?? "",
      owner: action.owner ?? "", dueDate: action.due_date ?? "", priority: action.priority as FormState["priority"],
      actionType: action.action_type as FormState["actionType"], runBy: action.run_by as FormState["runBy"],
      milestoneId: String(action.milestone_id ?? ""),
    });
    setFormError("");
    setShowCreate(true);
  };

  const create = async () => {
    if (!form.projectId) { setFormError("Choose the project this action belongs to."); return; }
    if (form.title.trim().length < 2 || !form.owner.trim() || !form.dueDate) { setFormError("Title, owner and due date are required."); return; }
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        await api.patch(`/actions/${editing.id}`, {
          title: form.title.trim(), description: form.description.trim() || null, owner: form.owner.trim(),
          due_date: form.dueDate, priority: form.priority, action_type: form.actionType,
        });
      } else {
        await api.post("/actions", {
          project_id: Number(form.projectId), title: form.title.trim(), description: form.description.trim() || null,
          owner: form.owner.trim(), due_date: form.dueDate, priority: form.priority, action_type: form.actionType,
          run_by: form.runBy, milestone_id: form.milestoneId ? Number(form.milestoneId) : null,
        });
        setView("All Actions");
        setStatus(""); setRunBy("");
      }
      setShowCreate(false);
      tell(editing ? "Action updated." : "Action created.");
      list.reload();
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Could not save this action."));
    } finally {
      setSaving(false);
    }
  };

  const setActionStatus = async (action: Action, next: string) => {
    try {
      const { data } = await api.patch<Action>(`/actions/${action.id}`, { status: next });
      setSelected(data);
      list.reload();
    } catch (error) {
      tell(getApiErrorMessage(error, "Could not update this action."), "error");
    }
  };

  const decide = async (action: Action, decision: "approve" | "reject") => {
    try {
      await api.post(`/actions/${action.id}/approval`, { decision });
      tell(`${action.title} ${decision === "approve" ? "approved" : "rejected"}.`);
      list.reload();
    } catch (error) {
      tell(getApiErrorMessage(error, "Could not record this decision."), "error");
    }
  };

  const waiting = list.data?.awaiting_approval ?? [];

  return (
    <section className="feature-page actions-page">
      <header className="feature-heading">
        <div><h1>Actions</h1><p>Manage actions and task execution</p></div>
        {canWrite ? <button type="button" className="actions-create-button" disabled={!projects.data} onClick={openCreate}><span aria-hidden="true">＋</span> Create action</button> : null}
      </header>
      <Notice message={notice} tone={noticeTone} />
      {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : null}

      <div className="actions-workspace">
        <section className="feature-card action-table-card">
          <div className="action-toolbar">
            <div className="filter-tabs" role="tablist" aria-label="Filter actions">
              {(["My Actions", "All Actions"] as View[]).map((item) => (
                <button key={item} type="button" role="tab" aria-selected={view === item} className={view === item ? "is-selected" : ""} onClick={() => setView(item)}>{item}</button>
              ))}
            </div>
            <div className="action-filters">
              <label><span className="visually-hidden">Filter action status</span><select aria-label="Filter action status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All status</option>{STATUS_FILTERS.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span className="visually-hidden">Filter action agents</span><select aria-label="Filter action agents" value={runBy} onChange={(event) => setRunBy(event.target.value)}><option value="">All agents</option><option>AI agent</option><option>Manual</option></select></label>
            </div>
          </div>
          {list.loading && !list.data ? <LoadingState /> : (
            <div className="responsive-table-wrap">
              <table className="feature-table action-table">
                <thead><tr><th>Action</th><th>Project</th><th>Type</th><th>Priority</th><th>Status</th><th>Owner</th><th>Due date</th><th>Run by</th>{canWrite ? <th><span className="visually-hidden">Actions</span></th> : null}</tr></thead>
                <tbody>
                  {items.map((action) => (
                    <tr key={action.id}>
                      <td><button type="button" className="table-title-button" onClick={() => setSelected(action)}>{action.title}</button></td>
                      <td>{action.project_name ?? "—"}</td>
                      <td>{action.action_type}</td>
                      <td><span className={`priority-pill priority-${action.priority.toLowerCase()}`}>{action.priority}</span></td>
                      <td><span className={`status-pill status-${(action.is_overdue ? "Overdue" : action.status).toLowerCase().replace(" ", "-")}`}>{action.is_overdue ? "Overdue" : action.status}</span></td>
                      <td>{action.owner ?? "—"}</td><td>{formatDate(action.due_date)}</td>
                      <td><span className={`agent-pill agent-pill--${action.run_by === "AI agent" ? "ai" : "manual"}`}>{action.run_by}</span></td>
                      {canWrite ? <td><button type="button" className="table-action-button" aria-label={`Edit ${action.title}`} onClick={() => openEdit(action)}>Edit</button></td> : null}
                    </tr>
                  ))}
                  {list.data && !items.length ? (
                    <tr><td colSpan={canWrite ? 9 : 8} className="table-empty">{view === "My Actions" && !status && !runBy ? "No actions are assigned to you. Switch to All Actions to see everyone's." : "No actions match these filters."}</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
          <div className="table-footer">Showing {items.length} of {list.data?.total ?? 0} actions · {list.data?.completed ?? 0} completed · {list.data?.overdue ?? 0} overdue</div>
        </section>

        <aside className="feature-card action-approval-card">
          <h2>Awaiting your approval</h2><p>AI agents pause here before acting</p>
          <div className="approval-request-list">
            {waiting.slice(0, 2).map((action) => (
              <article className="approval-request" key={action.id}>
                <strong>{action.title}</strong><p>{action.description ?? `${action.project_name ?? "Project"} · due ${formatDate(action.due_date)}`}</p>
                {canApprove ? (
                  <div>
                    <button type="button" className="approval-accept-button" onClick={() => void decide(action, "approve")}>Approve</button>
                    <button type="button" className="approval-reject-button" onClick={() => void decide(action, "reject")}>Reject</button>
                  </div>
                ) : <small className="pl-muted">Waiting for an approver.</small>}
              </article>
            ))}
            {!waiting.length ? <p className="approval-empty">No actions are waiting for approval.</p> : null}
          </div>
        </aside>
      </div>

      {showCreate ? (
        <FormDrawer
          title={editing ? `Edit Action - ${editing.title}` : "Create Action"}
          subtitle={editing ? "Update the action details" : "Assign a task or approval to an owner"}
          submitLabel={editing ? "Save changes" : "Add action"}
          saving={saving}
          error={formError}
          onClose={() => setShowCreate(false)}
          onSubmit={() => void create()}
        >
          <Field label="Project" required hint={editing ? "The project cannot be changed." : undefined}>
            <select disabled={Boolean(editing)} value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value, milestoneId: "" })}>
              <option value="">Select project</option>
              {(projects.data?.items ?? []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </Field>
          <Field label="Action Title" required>
            <input maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="What needs to be done?" />
          </Field>
          <div className="wiz-row">
            <Field label="Owner" required>
              <input maxLength={100} value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} />
            </Field>
            <Field label="Due Date" required>
              <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
            </Field>
          </div>
          <div className="wiz-row">
            <Field label="Priority">
              <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as FormState["priority"] })}><option>High</option><option>Medium</option><option>Low</option></select>
            </Field>
            <Field label="Type">
              <select value={form.actionType} onChange={(event) => setForm({ ...form, actionType: event.target.value as FormState["actionType"] })}><option>Task</option><option>Approval</option></select>
            </Field>
          </div>
          <div className="wiz-row">
            <Field label="Run By" hint={editing ? "Cannot be changed after creation." : undefined}>
              <select disabled={Boolean(editing)} value={form.runBy} onChange={(event) => setForm({ ...form, runBy: event.target.value as FormState["runBy"] })}><option>Manual</option><option>AI agent</option></select>
            </Field>
            <Field label="Milestone">
              <select disabled={Boolean(editing)} value={form.milestoneId} onChange={(event) => setForm({ ...form, milestoneId: event.target.value })}>
                <option value="">None</option>
                {(milestones.data?.items ?? []).map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.name}</option>)}
                {editing && editing.milestone_id && !milestones.data ? <option value={editing.milestone_id}>{editing.milestone_name}</option> : null}
              </select>
            </Field>
          </div>
          <Field label="Details">
            <textarea rows={3} maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </Field>
          {!editing && form.runBy === "AI agent" ? <p className="wiz-hint">AI agent actions wait for an approver before they start.</p> : null}
        </FormDrawer>
      ) : null}

      {selected ? (
        <Modal eyebrow={`ACT-${selected.id} · ${selected.project_code ?? selected.project_name ?? ""}`} title={selected.title} onClose={() => setSelected(null)}>
          <p className="modal-description">{selected.description ?? "No details recorded."}</p>
          <div className="risk-fact-grid">
            <div><span>Owner</span><strong>{selected.owner ?? "—"}</strong></div>
            <div><span>Milestone</span><strong>{selected.milestone_name ?? "—"}</strong></div>
            <div><span>Due date</span><strong>{formatDate(selected.due_date)}</strong></div>
            <div><span>Priority / status</span><strong>{selected.priority} · {selected.is_overdue ? "Overdue" : selected.status}</strong></div>
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setSelected(null)}>Close</button>
            {canWrite ? <button type="button" className="secondary-button" onClick={() => openEdit(selected)}>Edit</button> : null}
            {canWrite ? (
              <button type="button" className="primary-button" onClick={() => void setActionStatus(selected, CLOSED.includes(selected.status) ? "Open" : "Closed")}>
                {CLOSED.includes(selected.status) ? "Reopen Action" : "Mark Complete"}
              </button>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
