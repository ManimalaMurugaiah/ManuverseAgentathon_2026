import { useState } from "react";

type SettingsSection = "Project Configuration" | "Users & Roles" | "Notifications" | "Governance Rules" | "Integrations" | "System Preferences";
type ProjectTab = "Project Details" | "Milestones & Dependencies" | "Owners" | "Advanced Settings";

const settingSections: SettingsSection[] = ["Project Configuration", "Users & Roles", "Notifications", "Governance Rules", "Integrations", "System Preferences"];
const initialMilestones = [
  { name: "Engineering Approval", date: "2026-10-10", owner: "Ravi", status: "Delayed" },
  { name: "PO Release", date: "2026-10-12", owner: "Kumar", status: "At Risk" },
  { name: "Material Delivery", date: "2026-10-20", owner: "Vendor A", status: "At Risk" },
  { name: "Installation", date: "2026-10-25", owner: "Site Team", status: "Not Started" },
  { name: "Commissioning", date: "2026-10-30", owner: "Commissioning Team", status: "Not Started" },
];

export function SettingsPage(): JSX.Element {
  const [section, setSection] = useState<SettingsSection>("Project Configuration");
  const [projectTab, setProjectTab] = useState<ProjectTab>("Project Details");
  const [showInvite, setShowInvite] = useState(false);
  const [projectName, setProjectName] = useState("Project Alpha - Expansion Plant");
  const [description, setDescription] = useState("Expansion of production plant with new line installation.");
  const [startDate, setStartDate] = useState("2026-10-01");
  const [endDate, setEndDate] = useState("2026-11-30");
  const [projectStatus, setProjectStatus] = useState("On Track");
  const [milestones, setMilestones] = useState(initialMilestones);
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    "Enable AI insights": true, "Send escalation notifications": true, "Auto follow-up for overdue actions": true,
    "Email notifications": true, "SMS notifications": false, "Require approval for high risks": true,
    "Notify on overdue milestones": true, "Daily summary email": false,
  });
  const [recipients, setRecipients] = useState(["Project Manager", "Engineering Lead"]);
  const [recipientInput, setRecipientInput] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [newMilestone, setNewMilestone] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Viewer");
  const [users, setUsers] = useState([
    { name: "Ravi Kumar", email: "ravi.kumar@example.com", role: "Project Manager", access: "All projects", status: "Active" },
    { name: "Anita Rao", email: "anita.rao@example.com", role: "Engineering", access: "PRJ-001", status: "Active" },
    { name: "Kumar Patel", email: "kumar.patel@example.com", role: "Procurement", access: "PRJ-001, PRJ-002", status: "Active" },
    { name: "Meera Shah", email: "meera.shah@example.com", role: "Approver", access: "PRJ-002", status: "Invited" },
  ]);

  const saveSettings = (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setSavedMessage("Your changes are saved in this demo session.");
    window.setTimeout(() => setSavedMessage(""), 3500);
  };
  const toggle = (name: string) => setToggles((current) => ({ ...current, [name]: !current[name] }));
  const addRecipient = () => {
    const name = recipientInput.trim();
    if (name && !recipients.includes(name)) setRecipients((current) => [...current, name]);
    setRecipientInput("");
  };
  const addMilestone = () => {
    const name = newMilestone.trim();
    if (!name) return;
    setMilestones((current) => [...current, { name, date: "2026-11-15", owner: "Unassigned", status: "Not Started" }]);
    setNewMilestone("");
  };
  const sendInvite = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUsers((current) => [...current, { name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole, access: "Project Alpha", status: "Invited" }]);
    setSavedMessage(`Demo invitation created for ${inviteEmail.trim()}.`);
    setInviteName("");
    setInviteEmail("");
    setInviteRole("Viewer");
    setShowInvite(false);
  };

  return (
    <section className="feature-page settings-page">
      <header className="feature-heading"><div><span className="eyebrow">WORKSPACE PREFERENCES · DEMO DATA</span><h1>Settings</h1><p>Configure project details, ownership, notifications, and workspace preferences.</p></div></header>
      <div className="settings-layout">
        <nav className="settings-nav feature-card" aria-label="Settings sections">
          {settingSections.map((item, index) => <button key={item} type="button" className={section === item ? "is-selected" : ""} onClick={() => { setSection(item); setSavedMessage(""); }}><span aria-hidden="true">{["▣", "♙", "♧", "⚖", "⌘", "⚙"][index]}</span>{item}</button>)}
        </nav>

        <div className="settings-main">
          {section === "Project Configuration" ? (
            <>
              <nav className="settings-tabs" aria-label="Project setting tabs">{(["Project Details", "Milestones & Dependencies", "Owners", "Advanced Settings"] as ProjectTab[]).map((item) => <button key={item} type="button" className={projectTab === item ? "is-selected" : ""} onClick={() => setProjectTab(item)}>{item}</button>)}</nav>
              <div className="settings-project-grid">
                <section className="feature-card settings-panel">
                  {projectTab === "Project Details" ? (
                    <form className="settings-form" onSubmit={saveSettings}>
                      <h2>Project Information</h2>
                      <label>Project name<input value={projectName} onChange={(event) => setProjectName(event.target.value)} /></label>
                      <label>Description<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
                      <div className="form-row"><label>Start date<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>Planned end date<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label></div>
                      <label>Project status<select value={projectStatus} onChange={(event) => setProjectStatus(event.target.value)}><option>On Track</option><option>At Risk</option><option>Delayed</option><option>Completed</option></select></label>
                      <div className="modal-actions settings-form-actions"><button type="button" className="secondary-button" onClick={() => { setProjectName("Project Alpha - Expansion Plant"); setDescription("Expansion of production plant with new line installation."); setStartDate("2026-10-01"); setEndDate("2026-11-30"); setProjectStatus("On Track"); setSavedMessage(""); }}>Reset</button><button type="submit" className="primary-button">Save Changes</button></div>
                    </form>
                  ) : null}
                  {projectTab === "Milestones & Dependencies" ? (
                    <div className="settings-list-panel"><div className="feature-card-heading"><div><h2>Milestones &amp; dependencies</h2><p>Adjust the demo project schedule.</p></div></div><div className="milestone-settings-list">{milestones.map((item, index) => <article key={`${item.name}-${index}`}><span className="milestone-index">{String(index + 1).padStart(2, "0")}</span><div><strong>{item.name}</strong><small>{item.owner} · {item.date}</small></div><span className={`status-pill status-${item.status.toLowerCase().replace(" ", "-")}`}>{item.status}</span></article>)}</div><div className="inline-add-row"><input value={newMilestone} onChange={(event) => setNewMilestone(event.target.value)} placeholder="New milestone name" aria-label="New milestone name" /><button type="button" className="secondary-button" onClick={addMilestone}>Add milestone</button></div></div>
                  ) : null}
                  {projectTab === "Owners" ? (
                    <div className="settings-list-panel"><h2>Project owners</h2><p className="muted">Sample project responsibilities. Assignments are local demo values.</p>{[["Project manager", "Ravi Kumar"], ["Engineering lead", "Anita Rao"], ["Procurement owner", "Kumar Patel"], ["Site readiness lead", "Meera Shah"]].map(([role, name]) => <label className="owner-setting-row" key={role}>{role}<input defaultValue={name} /></label>)}<button type="button" className="primary-button" onClick={() => saveSettings()}>Save owner changes</button></div>
                  ) : null}
                  {projectTab === "Advanced Settings" ? (
                    <div className="settings-list-panel"><h2>Advanced project settings</h2><p className="muted">Configure demo project defaults and escalation behavior.</p><label>Project code<input defaultValue="PRJ-001" /></label><label>Reporting timezone<select defaultValue="Asia/Kolkata"><option>Asia/Kolkata</option><option>UTC</option><option>America/Chicago</option><option>Europe/London</option></select></label><ToggleRow label="Automatically flag overdue milestones" checked={toggles["Notify on overdue milestones"]} onChange={() => toggle("Notify on overdue milestones")} /><ToggleRow label="Require an owner for every action" checked={toggles["Require approval for high risks"]} onChange={() => toggle("Require approval for high risks")} /><button type="button" className="primary-button" onClick={() => saveSettings()}>Save advanced settings</button></div>
                  ) : null}
                </section>
                <section className="feature-card settings-milestones-panel"><div className="feature-card-heading"><div><h2>Project milestones</h2><p>Current schedule snapshot</p></div></div><div className="settings-milestone-table">{milestones.slice(0, 5).map((item, index) => <article key={`${item.name}-${index}`}><strong>{item.name}</strong><span>{new Date(`${item.date}T12:00:00`).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}</span><small>{item.owner}</small><span className={`status-pill status-${item.status.toLowerCase().replace(" ", "-")}`}>{item.status}</span></article>)}</div><button type="button" className="text-action" onClick={() => setProjectTab("Milestones & Dependencies")}>Manage milestones <span aria-hidden="true">→</span></button></section>
              </div>
            </>
          ) : null}

          {section === "Users & Roles" ? <section className="feature-card settings-section-card"><div className="feature-card-heading"><div><h2>Users &amp; roles</h2><p>Sample access roster for this project.</p></div><button type="button" className="primary-button" onClick={() => setShowInvite(true)}>＋ Invite user</button></div><div className="responsive-table-wrap"><table className="feature-table"><thead><tr><th>Name</th><th>Role</th><th>Project access</th><th>Status</th></tr></thead><tbody>{users.map((user) => <tr key={user.email}><td><strong>{user.name}</strong><br /><small>{user.email}</small></td><td>{user.role}</td><td>{user.access}</td><td><span className={`status-pill status-${user.status.toLowerCase()}`}>{user.status}</span></td></tr>)}</tbody></table></div></section> : null}

          {section === "Notifications" ? <section className="feature-card settings-section-card"><h2>Notification preferences</h2><p className="muted">Choose which project events should notify your team.</p><div className="toggle-settings-list">{["Email notifications", "SMS notifications", "Send escalation notifications", "Daily summary email", "Notify on overdue milestones"].map((name) => <ToggleRow key={name} label={name} checked={Boolean(toggles[name])} onChange={() => toggle(name)} />)}</div><div className="recipient-manager"><h3>Notification recipients</h3><div className="recipient-chips">{recipients.map((recipient) => <button type="button" key={recipient} onClick={() => setRecipients((current) => current.filter((item) => item !== recipient))} title={`Remove ${recipient}`}>{recipient}<span aria-hidden="true"> ×</span></button>)}</div><div className="inline-add-row"><input value={recipientInput} onChange={(event) => setRecipientInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addRecipient(); } }} placeholder="Add a person or team" aria-label="Add notification recipient" /><button type="button" className="secondary-button" onClick={addRecipient}>Add recipient</button></div></div><button type="button" className="primary-button" onClick={() => saveSettings()}>Save notification settings</button></section> : null}

          {section === "Governance Rules" ? <section className="feature-card settings-section-card"><h2>Governance rules</h2><p className="muted">Set review and escalation expectations for sample workflows.</p><div className="toggle-settings-list">{[["Require approval for high risks", "High severity issues must be reviewed before closure."], ["Auto follow-up for overdue actions", "Create a follow-up when a due date is missed."], ["Enable two-person milestone approval", "Require a second reviewer on critical milestones."], ["Require an owner for every action", "Keep all open actions assigned to a person or team."]].map(([name, detail]) => <ToggleRow key={name} label={name} detail={detail} checked={Boolean(toggles[name])} onChange={() => toggle(name)} />)}</div><label className="settings-select-row">Escalate overdue items after<select defaultValue="2 days"><option>1 day</option><option>2 days</option><option>3 days</option><option>1 week</option></select></label><button type="button" className="primary-button" onClick={() => saveSettings()}>Save governance rules</button></section> : null}

          {section === "Integrations" ? <section className="feature-card settings-section-card"><h2>Integrations</h2><p className="muted">Connect project tools. These demo controls do not send data to external services.</p><div className="integration-list">{[["PostgreSQL", "Project, risk, and action data source", "Connect later"], ["Email", "Send milestone and action notifications", toggles["Email notifications"] ? "Enabled" : "Disabled"], ["AI insights", "Generate summaries and suggested next steps", toggles["Enable AI insights"] ? "Enabled" : "Disabled"]].map(([name, detail, status]) => <article key={name}><span className="integration-icon">{name === "PostgreSQL" ? "▤" : name === "Email" ? "✉" : "✦"}</span><div><strong>{name}</strong><small>{detail}</small></div><span className={`status-pill ${status === "Enabled" ? "status-active" : "status-monitoring"}`}>{status}</span><button type="button" className="secondary-button" onClick={() => name === "AI insights" || name === "Email" ? toggle(name === "AI insights" ? "Enable AI insights" : "Email notifications") : setSavedMessage("PostgreSQL is a demo placeholder. The database connection will be added when project connection details are available.")}>{status === "Enabled" ? "Manage" : name === "PostgreSQL" ? "Configure" : "Enable"}</button></article>)}</div></section> : null}

          {section === "System Preferences" ? <section className="feature-card settings-section-card"><h2>System preferences</h2><p className="muted">Personalize how dates, reports, and the interface are shown.</p><label className="settings-select-row">Date format<select defaultValue="DD MMM YYYY"><option>DD MMM YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option></select></label><label className="settings-select-row">Default report period<select defaultValue="Weekly"><option>Daily</option><option>Weekly</option><option>Monthly</option><option>Yearly</option></select></label><label className="settings-select-row">Dashboard refresh<select defaultValue="Manual"><option>Manual</option><option>Every 5 minutes</option><option>Every 15 minutes</option></select></label><ToggleRow label="Enable AI insights" checked={Boolean(toggles["Enable AI insights"])} onChange={() => toggle("Enable AI insights")} /><button type="button" className="primary-button" onClick={() => saveSettings()}>Save preferences</button></section> : null}

          {savedMessage ? <div className="settings-saved-message" role="status">✓ {savedMessage}</div> : null}
        </div>

        <aside className="settings-quick-column">
          <section className="feature-card quick-settings-card"><h2>Quick settings</h2>{["Enable AI insights", "Send escalation notifications", "Auto follow-up for overdue actions", "Email notifications", "SMS notifications"].map((name) => <ToggleRow key={name} label={name} checked={Boolean(toggles[name])} onChange={() => toggle(name)} />)}<button type="button" className="text-action" onClick={() => setSection("Notifications")}>Notification settings <span aria-hidden="true">→</span></button></section>
          <section className={`project-health-callout project-health-${projectStatus.toLowerCase().replace(" ", "-")}`}><span className="health-alert-icon" aria-hidden="true">!</span><div><strong>Your project is currently<br /><b>{projectStatus.toUpperCase()}</b></strong><small>{milestones.filter((item) => item.status === "Delayed" || item.status === "At Risk").length} critical issues require attention.</small><button type="button" onClick={() => setSection("Governance Rules")}>View governance rules <span aria-hidden="true">→</span></button></div></section>
        </aside>
      </div>
      {showInvite ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowInvite(false); }}>
          <section className="feature-modal" role="dialog" aria-modal="true" aria-labelledby="invite-user-title">
            <div className="modal-heading"><div><span className="eyebrow">USERS &amp; ROLES</span><h2 id="invite-user-title">Invite a project user</h2></div><button type="button" className="modal-close" aria-label="Close" onClick={() => setShowInvite(false)}>×</button></div>
            <form className="feature-form" onSubmit={sendInvite}>
              <label>Name<input required maxLength={80} value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="Full name" /></label>
              <label>Email<input required type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@example.com" /></label>
              <label>Role<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}><option>Viewer</option><option>Engineering</option><option>Approver</option><option>Manager</option></select></label>
              <p className="demo-footnote">This adds a sample invite to the on-screen roster; no email is sent.</p>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowInvite(false)}>Cancel</button><button type="submit" className="primary-button">Create Invite</button></div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function ToggleRow({ label, detail, checked, onChange }: { label: string; detail?: string; checked: boolean; onChange: () => void }): JSX.Element {
  return <div className="toggle-row"><span><strong>{label}</strong>{detail ? <small>{detail}</small> : null}</span><button type="button" role="switch" aria-checked={checked} aria-label={label} className={`switch${checked ? " is-on" : ""}`} onClick={onChange}><span /></button></div>;
}
