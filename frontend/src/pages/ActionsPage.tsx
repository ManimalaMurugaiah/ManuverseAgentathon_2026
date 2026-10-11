import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { sampleActions, sampleBusinesses, type SampleAction } from "./sampleData";

type ActionView = "My Actions" | "All Actions";
type ActionStatusFilter = "All status" | SampleAction["status"];
type AgentFilter = "All agents" | SampleAction["runBy"];

const formatDueDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export function ActionsPage(): JSX.Element {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const selectedProject = searchParams.get("project_code") ?? "";
  const selectedBusiness = searchParams.get("business") ?? "";
  const [actions, setActions] = useState(() => sampleActions.map((action, index) =>
    index === 0 && user?.username ? { ...action, owner: user.username } : action,
  ));
  const [view, setView] = useState<ActionView>("My Actions");
  const [statusFilter, setStatusFilter] = useState<ActionStatusFilter>("All status");
  const [agentFilter, setAgentFilter] = useState<AgentFilter>("All agents");
  const [selectedAction, setSelectedAction] = useState<SampleAction | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPriority, setNewPriority] = useState<SampleAction["priority"]>("Medium");
  const [handledApprovals, setHandledApprovals] = useState<string[]>([]);
  const [approvalFeedback, setApprovalFeedback] = useState("");

  const filteredActions = useMemo(() => actions.filter((action) => {
    const matchesProject = !selectedProject || action.project === selectedProject;
    const matchesBusiness = !selectedBusiness || action.business === selectedBusiness;
    const matchesView = view === "All Actions" || action.owner.toLowerCase() === (user?.username.toLowerCase() ?? "ravi");
    const matchesStatus = statusFilter === "All status" || action.status === statusFilter;
    const matchesAgent = agentFilter === "All agents" || action.runBy === agentFilter;
    return matchesProject && matchesBusiness && matchesView && matchesStatus && matchesAgent;
  }), [actions, agentFilter, selectedBusiness, selectedProject, statusFilter, user?.username, view]);

  const businessActions = actions.filter((action) => !selectedBusiness || action.business === selectedBusiness);
  const completeCount = businessActions.filter((action) => action.status === "Completed").length;
  const overdueCount = businessActions.filter((action) => action.status === "Overdue").length;
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
      business: selectedBusiness || sampleBusinesses[0],
      milestone: "General",
      actionType: "Task",
      owner: newOwner.trim(),
      priority: newPriority,
      dueDate: newDueDate,
      status: "Open",
      runBy: "Manual",
      project: selectedProject || "PRJ-001",
      details: "New demo action. Add a description when connecting this screen to your project data.",
    };
    setActions((current) => [action, ...current]);
    setView("All Actions");
    setShowCreate(false);
    setNewTitle("");
    setNewOwner("");
    setNewDueDate("");
    setNewPriority("Medium");
  };

  return (
    <section className="feature-page actions-page">
      <header className="feature-heading">
        <div><h1>Actions</h1><p>Manage actions and task execution</p></div>
        <button type="button" className="actions-create-button" onClick={() => setShowCreate(true)}><span aria-hidden="true">＋</span> Create action</button>
      </header>
      <div className="actions-workspace">
        <section className="feature-card action-table-card">
          <div className="action-toolbar">
            <div className="filter-tabs" role="tablist" aria-label="Filter actions">
              {(["My Actions", "All Actions"] as ActionView[]).map((item) => (
                <button key={item} type="button" role="tab" aria-selected={view === item} className={view === item ? "is-selected" : ""} onClick={() => setView(item)}>{item}</button>
              ))}
            </div>
            <div className="action-filters">
              <label><span className="visually-hidden">Filter action status</span><select aria-label="Filter action status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ActionStatusFilter)}><option>All status</option><option>Open</option><option>In Progress</option><option>Overdue</option><option>Completed</option></select></label>
              <label><span className="visually-hidden">Filter action agents</span><select aria-label="Filter action agents" value={agentFilter} onChange={(event) => setAgentFilter(event.target.value as AgentFilter)}><option>All agents</option><option>AI agent</option><option>Manual</option></select></label>
            </div>
          </div>
          <div className="responsive-table-wrap">
            <table className="feature-table action-table">
              <thead><tr><th>Action</th><th>Type</th><th>Priority</th><th>Status</th><th>Owner</th><th>Due date</th><th>Run by</th></tr></thead>
              <tbody>
                {filteredActions.map((action) => (
                  <tr key={action.id}>
                    <td><button type="button" className="table-title-button" onClick={() => setSelectedAction(action)}>{action.title}</button></td>
                    <td>{action.actionType}</td>
                    <td><span className={`priority-pill priority-${action.priority.toLowerCase()}`}>{action.priority}</span></td>
                    <td><span className={`status-pill status-${action.status.toLowerCase().replace(" ", "-")}`}>{action.status}</span></td>
                    <td>{action.owner}</td><td>{formatDueDate(action.dueDate)}</td>
                    <td><span className={`agent-pill agent-pill--${action.runBy === "AI agent" ? "ai" : "manual"}`}>{action.runBy}</span></td>
                  </tr>
                ))}
                {filteredActions.length === 0 ? <tr><td colSpan={7} className="table-empty">No actions match these filters.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="table-footer">Showing {filteredActions.length} of {businessActions.length} actions · {completeCount} completed · {overdueCount} overdue</div>
        </section>

        <aside className="feature-card action-approval-card">
          <h2>Awaiting your approval</h2><p>AI agents pause here before acting</p>
          {approvalFeedback ? <p role="status" className="screen-feedback">{approvalFeedback}</p> : null}
          <div className="approval-request-list">
            {actions.filter((action) => action.runBy === "AI agent" && action.status === "Open" && !handledApprovals.includes(action.id)).slice(0, 2).map((action) => (
              <article className="approval-request" key={action.id}>
                <strong>{action.title}</strong><p>{action.details}</p>
                <div><button type="button" className="approval-accept-button" onClick={() => { setActions((current) => current.map((item) => item.id === action.id ? { ...item, status: "In Progress" } : item)); setHandledApprovals((current) => [...current, action.id]); setApprovalFeedback(`${action.title} approved.`); }}>Approve</button><button type="button" className="approval-reject-button" onClick={() => { setHandledApprovals((current) => [...current, action.id]); setApprovalFeedback(`${action.title} rejected.`); }}>Reject</button></div>
              </article>
            ))}
            {!actions.some((action) => action.runBy === "AI agent" && action.status === "Open" && !handledApprovals.includes(action.id)) ? <p className="approval-empty">No actions are waiting for approval.</p> : null}
          </div>
        </aside>
      </div>

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
