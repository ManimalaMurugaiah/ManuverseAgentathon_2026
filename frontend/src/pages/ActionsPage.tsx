import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { sampleActions, type SampleAction } from "./sampleData";

type ActionView = "All Actions" | "My Actions" | "Overdue";

const formatDueDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export function ActionsPage(): JSX.Element {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const selectedProject = searchParams.get("project_code") ?? "";
  const [actions, setActions] = useState(() => sampleActions.map((action, index) =>
    index === 0 && user?.username ? { ...action, owner: user.username } : action,
  ));
  const [view, setView] = useState<ActionView>("All Actions");
  const [query, setQuery] = useState("");
  const [selectedAction, setSelectedAction] = useState<SampleAction | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPriority, setNewPriority] = useState<SampleAction["priority"]>("Medium");

  const filteredActions = useMemo(() => actions.filter((action) => {
    const matchesProject = !selectedProject || action.project === selectedProject;
    const matchesView = view === "All Actions"
      || (view === "Overdue" ? action.status === "Overdue" : action.owner.toLowerCase() === user?.username.toLowerCase());
    const search = query.trim().toLowerCase();
    const matchesQuery = !search || `${action.id} ${action.title} ${action.milestone} ${action.owner}`.toLowerCase().includes(search);
    return matchesProject && matchesView && matchesQuery;
  }), [actions, query, selectedProject, user?.username, view]);

  const completeCount = actions.filter((action) => action.status === "Completed").length;
  const overdueCount = actions.filter((action) => action.status === "Overdue").length;
  const setActionStatus = (action: SampleAction) => {
    const nextStatus: SampleAction["status"] = action.status === "Completed" ? "Open" : "Completed";
    setActions((current) => current.map((item) => item.id === action.id ? { ...item, status: nextStatus } : item));
    setSelectedAction((current) => current?.id === action.id ? { ...current, status: nextStatus } : current);
  };
  const createAction = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const action: SampleAction = {
      id: `A-${String(Date.now()).slice(-3)}`,
      title: newTitle.trim(),
      milestone: "General",
      owner: newOwner.trim(),
      priority: newPriority,
      dueDate: newDueDate,
      status: "Open",
      project: selectedProject || "PRJ-001",
      details: "New demo action. Add a description when connecting this screen to your project data.",
    };
    setActions((current) => [action, ...current]);
    setView("All Actions");
    setQuery("");
    setShowCreate(false);
    setNewTitle("");
    setNewOwner("");
    setNewDueDate("");
    setNewPriority("Medium");
  };

  return (
    <section className="feature-page actions-page">
      <header className="feature-heading">
        <div><span className="eyebrow">FOLLOW-UPS · DEMO DATA</span><h1>Actions</h1><p>Track and manage corrective actions, follow-ups, and escalations.</p></div>
        <button type="button" className="primary-button" onClick={() => setShowCreate(true)}><span aria-hidden="true">＋</span> Create Action</button>
      </header>
      <div className="demo-data-note"><span aria-hidden="true">ⓘ</span> Example actions are stored in this browser session only.</div>

      <div className="feature-metrics action-metrics">
        <article className="feature-metric"><span>Total actions</span><strong>{actions.length}</strong><small>All demo projects</small></article>
        <article className="feature-metric metric-blue"><span>Open</span><strong>{actions.filter((action) => action.status === "Open").length}</strong><small>Awaiting a start</small></article>
        <article className="feature-metric metric-sky"><span>In progress</span><strong>{actions.filter((action) => action.status === "In Progress").length}</strong><small>Being worked on</small></article>
        <article className="feature-metric metric-green"><span>Completed</span><strong>{completeCount}</strong><small>Closed actions</small></article>
        <article className="feature-metric metric-red"><span>Overdue</span><strong>{overdueCount}</strong><small>Past due date</small></article>
      </div>

      <section className="feature-card action-table-card">
        <div className="action-toolbar">
          <div className="filter-tabs" role="tablist" aria-label="Filter actions">
            {(["All Actions", "My Actions", "Overdue"] as ActionView[]).map((item) => (
              <button key={item} type="button" role="tab" aria-selected={view === item} className={view === item ? "is-selected" : ""} onClick={() => setView(item)}>{item}</button>
            ))}
          </div>
          <label className="table-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search actions..." aria-label="Search actions" /><button type="button" aria-label="Clear search" onClick={() => setQuery("")}>×</button></label>
        </div>
        <div className="responsive-table-wrap">
          <table className="feature-table action-table">
            <thead><tr><th>ID</th><th>Action</th><th>Related milestone</th><th>Owner</th><th>Priority</th><th>Due date</th><th>Status</th><th>Update</th></tr></thead>
            <tbody>
              {filteredActions.map((action) => (
                <tr key={action.id}>
                  <td className="action-id">{action.id}</td>
                  <td><button type="button" className="table-title-button" onClick={() => setSelectedAction(action)}>{action.title}</button></td>
                  <td>{action.milestone}</td><td>{action.owner}</td>
                  <td><span className={`priority-pill priority-${action.priority.toLowerCase()}`}>{action.priority}</span></td>
                  <td>{formatDueDate(action.dueDate)}</td>
                  <td><span className={`status-pill status-${action.status.toLowerCase().replace(" ", "-")}`}>{action.status}</span></td>
                  <td><button type="button" className="table-action-button" onClick={() => setActionStatus(action)} aria-label={`${action.status === "Completed" ? "Reopen" : "Complete"} ${action.id}`}>{action.status === "Completed" ? "Reopen" : "Complete"}</button></td>
                </tr>
              ))}
              {filteredActions.length === 0 ? <tr><td colSpan={8} className="table-empty">No actions match this view. Try another tab or search term.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="table-footer">Showing {filteredActions.length} of {actions.length} demo actions</div>
      </section>

      {showCreate ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreate(false); }}>
          <section className="feature-modal" role="dialog" aria-modal="true" aria-labelledby="create-action-title">
            <div className="modal-heading"><div><span className="eyebrow">ACTION REGISTER</span><h2 id="create-action-title">Create an action</h2></div><button type="button" className="modal-close" aria-label="Close" onClick={() => setShowCreate(false)}>×</button></div>
            <form className="feature-form" onSubmit={createAction}>
              <label>Action title<input required maxLength={120} value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="What needs to be done?" /></label>
              <div className="form-row"><label>Owner<input required maxLength={60} value={newOwner} onChange={(event) => setNewOwner(event.target.value)} placeholder="Name or team" /></label><label>Due date<input required type="date" value={newDueDate} onChange={(event) => setNewDueDate(event.target.value)} /></label></div>
              <label>Priority<select value={newPriority} onChange={(event) => setNewPriority(event.target.value as SampleAction["priority"])}><option>High</option><option>Medium</option><option>Low</option></select></label>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" className="primary-button">Add Action</button></div>
            </form>
          </section>
        </div>
      ) : null}
      {selectedAction ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedAction(null); }}>
          <section className="feature-modal" role="dialog" aria-modal="true" aria-labelledby="action-detail-title">
            <div className="modal-heading"><div><span className="eyebrow">{selectedAction.id} · {selectedAction.project}</span><h2 id="action-detail-title">{selectedAction.title}</h2></div><button type="button" className="modal-close" aria-label="Close" onClick={() => setSelectedAction(null)}>×</button></div>
            <p className="modal-description">{selectedAction.details}</p>
            <div className="risk-fact-grid"><div><span>Owner</span><strong>{selectedAction.owner}</strong></div><div><span>Milestone</span><strong>{selectedAction.milestone}</strong></div><div><span>Due date</span><strong>{formatDueDate(selectedAction.dueDate)}</strong></div><div><span>Priority / status</span><strong>{selectedAction.priority} · {selectedAction.status}</strong></div></div>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setSelectedAction(null)}>Close</button><button type="button" className="primary-button" onClick={() => setActionStatus(selectedAction)}>{selectedAction.status === "Completed" ? "Reopen Action" : "Mark Complete"}</button></div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
