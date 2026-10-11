import { useMemo, useState } from "react";

type MilestoneStatus = "Completed" | "In progress" | "Not started";
type MilestonePhase = "All phases" | "Engineering" | "Procurement" | "Delivery" | "Installation";

interface Milestone {
  id: number;
  name: string;
  date: string;
  owner: string;
  status: MilestoneStatus;
  progress: number;
  phase: Exclude<MilestonePhase, "All phases">;
}

interface ApprovalStep {
  id: number;
  title: string;
  approver: string;
  status: "Done" | "Pending" | "Waiting";
}

const initialMilestones: Milestone[] = [
  { id: 1, name: "Engineering Approval", date: "2026-10-10", owner: "Ravi K.", status: "Completed", progress: 100, phase: "Engineering" },
  { id: 2, name: "PO Release", date: "2026-10-12", owner: "Anita S.", status: "Completed", progress: 100, phase: "Procurement" },
  { id: 3, name: "Material Delivery", date: "2026-10-25", owner: "Vikram N.", status: "In progress", progress: 60, phase: "Delivery" },
  { id: 4, name: "Installation", date: "2026-10-30", owner: "Kavitha R.", status: "Not started", progress: 0, phase: "Installation" },
  { id: 5, name: "Commissioning", date: "2026-11-15", owner: "Michael T.", status: "Not started", progress: 0, phase: "Installation" },
];

const initialApprovalSteps: ApprovalStep[] = [
  { id: 1, title: "Evidence submitted", approver: "Vikram N.", status: "Done" },
  { id: 2, title: "Engineering Lead review", approver: "Engineering Lead", status: "Done" },
  { id: 3, title: "Procurement approval", approver: "Procurement Lead", status: "Pending" },
  { id: 4, title: "Milestone closed", approver: "System", status: "Waiting" },
];

const phases: MilestonePhase[] = ["All phases", "Engineering", "Procurement", "Delivery", "Installation"];

const formatDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", {
  day: "numeric", month: "short", year: "numeric",
});

export function MilestonesPage(): JSX.Element {
  const [milestones, setMilestones] = useState(initialMilestones);
  const [phase, setPhase] = useState<MilestonePhase>("All phases");
  const [approvalSteps, setApprovalSteps] = useState(initialApprovalSteps);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [owner, setOwner] = useState("");
  const [newPhase, setNewPhase] = useState<Exclude<MilestonePhase, "All phases">>("Engineering");
  const [feedback, setFeedback] = useState("");
  const visibleMilestones = useMemo(
    () => milestones.filter((milestone) => phase === "All phases" || milestone.phase === phase),
    [milestones, phase],
  );
  const currentMilestone = milestones.find((milestone) => milestone.status === "In progress") ?? milestones[0];

  const addMilestone = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMilestones((current) => [...current, {
      id: Date.now(),
      name: name.trim(),
      date,
      owner: owner.trim(),
      status: "Not started",
      progress: 0,
      phase: newPhase,
    }]);
    setName("");
    setDate("");
    setOwner("");
    setNewPhase("Engineering");
    setShowCreate(false);
    setFeedback("Milestone added.");
  };

  const advanceApproval = (stepId: number) => {
    setApprovalSteps((steps) => steps.map((step) => step.id === stepId ? { ...step, status: "Done" } : step));
    const nextPending = approvalSteps.find((step) => step.id > stepId && step.status === "Waiting");
    if (nextPending) {
      setApprovalSteps((steps) => steps.map((step) => step.id === nextPending.id ? { ...step, status: "Pending" } : step));
    }
    setFeedback("Approval recorded.");
  };

  return (
    <section className="feature-page milestone-page">
      <header className="feature-heading">
        <div><h1>Milestones · Alpha Expansion Plant</h1><p>Track milestones, progress and approvals</p></div>
        <div className="milestone-heading-actions">
          <label className="visually-hidden" htmlFor="milestone-phase">Filter milestone phase</label>
          <select id="milestone-phase" value={phase} onChange={(event) => setPhase(event.target.value as MilestonePhase)}>
            {phases.map((item) => <option key={item}>{item}</option>)}
          </select>
          <button type="button" className="milestone-add-button" onClick={() => { setFeedback(""); setShowCreate(true); }}>＋ Add milestone</button>
        </div>
      </header>
      {feedback ? <p role="status" className="screen-feedback">{feedback}</p> : null}

      <section className="feature-card milestone-timeline-card" aria-labelledby="milestone-timeline-title">
        <h2 id="milestone-timeline-title">Timeline</h2>
        <ol className="milestone-timeline">
          {visibleMilestones.map((milestone) => (
            <li key={milestone.id} className={`timeline-stop timeline-stop--${milestone.status.toLowerCase().replace(" ", "-")}`}>
              <span className="timeline-stop-marker" aria-hidden="true">{milestone.status === "Completed" ? "✓" : ""}</span>
              <strong>{milestone.name}</strong>
              <small>{formatDate(milestone.date)}</small>
            </li>
          ))}
        </ol>
      </section>

      <div className="milestone-content-grid">
        <section className="feature-card milestone-table-card" aria-label="Milestone register">
          <div className="responsive-table-wrap">
            <table className="feature-table milestone-table" aria-label="Milestone register">
              <thead><tr><th>Milestone</th><th>Status</th><th>Progress</th><th>Due date</th><th>Owner</th></tr></thead>
              <tbody>
                {visibleMilestones.map((milestone) => (
                  <tr key={milestone.id}>
                    <td><strong>{milestone.name}</strong></td>
                    <td><span className={`status-pill milestone-status--${milestone.status.toLowerCase().replace(" ", "-")}`}>{milestone.status}</span></td>
                    <td><span className="milestone-progress"><span><i style={{ width: `${milestone.progress}%` }} /></span><strong>{milestone.progress}%</strong></span></td>
                    <td>{formatDate(milestone.date)}</td>
                    <td>{milestone.owner}</td>
                  </tr>
                ))}
                {visibleMilestones.length === 0 ? <tr><td colSpan={5} className="table-empty">No milestones in this phase.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="feature-card approval-card">
          <h2>Approval workflow</h2>
          <p>{currentMilestone?.name ?? "Milestone"} · evidence required to close</p>
          <ol className="approval-steps">
            {approvalSteps.map((step) => (
              <li key={step.id} className={`approval-step approval-step--${step.status.toLowerCase()}`}>
                <span className="approval-step-number">{step.status === "Done" ? "✓" : step.id}</span>
                <span className="approval-step-copy"><strong>{step.title}</strong><small>{step.approver}</small></span>
                {step.status === "Pending"
                  ? <button type="button" className="approval-status approval-status--pending" onClick={() => advanceApproval(step.id)}>Approve</button>
                  : <span className={`approval-status approval-status--${step.status.toLowerCase()}`}>{step.status}</span>}
              </li>
            ))}
          </ol>
          <div className="milestone-attachments" aria-label="Milestone evidence">
            <a href="data:text/plain,Delivery%20note%20for%20Material%20Delivery" download="Delivery_note.txt">Delivery_note.txt</a>
            <a href="data:text/plain,Site%20photos%20for%20Material%20Delivery" download="Site_photos.txt">Site_photos.txt</a>
          </div>
        </aside>
      </div>

      {showCreate ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreate(false); }}>
          <section className="feature-modal" role="dialog" aria-modal="true" aria-labelledby="add-milestone-title">
            <div className="modal-heading"><div><span className="eyebrow">MILESTONE REGISTER</span><h2 id="add-milestone-title">Add milestone</h2></div><button type="button" className="modal-close" aria-label="Close add milestone" onClick={() => setShowCreate(false)}>×</button></div>
            <form className="feature-form" onSubmit={addMilestone}>
              <label>Milestone name<input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>
              <div className="form-row"><label>Due date<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Owner<input required maxLength={60} value={owner} onChange={(event) => setOwner(event.target.value)} /></label></div>
              <label>Phase<select value={newPhase} onChange={(event) => setNewPhase(event.target.value as Exclude<MilestonePhase, "All phases">)}>{phases.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" className="milestone-add-button">Add milestone</button></div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
