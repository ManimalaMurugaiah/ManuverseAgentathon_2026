import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../api/client";
import { getApiErrorMessage } from "../api/errors";
import { useApiData } from "../api/useApiData";
import { useBusiness } from "../api/useBusiness";
import { Modal } from "../components/Modal";
import { ErrorState, LoadingState, Notice, Pill } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import type {
  AppSettings, GovernanceRule, HealthRating, Integration, Lifecycle, Lookups, ManagedUser, MilestoneList, ProjectDetail, ProjectList, Role,
} from "../types";
import { formatDate } from "../components/ProjectUi";

type Section = "Project Configuration" | "Users & Roles" | "Notifications" | "Governance Rules" | "Integrations" | "System Preferences";
type ProjectTab = "Project Details" | "Milestones & Dependencies" | "Owners" | "Advanced Settings";
type BoolKey = { [K in keyof AppSettings]: AppSettings[K] extends boolean ? K : never }[keyof AppSettings];

const SECTIONS: Section[] = ["Project Configuration", "Users & Roles", "Notifications", "Governance Rules", "Integrations", "System Preferences"];
const SECTION_ICONS = ["▣", "♙", "♧", "⚖", "⌘", "⚙"];
const PROJECT_TABS: ProjectTab[] = ["Project Details", "Milestones & Dependencies", "Owners", "Advanced Settings"];
const HEALTH: HealthRating[] = ["Good", "Watch", "Poor"];
const ROLES: Role[] = ["admin", "manager", "engineering", "approver", "viewer"];
const SETTINGS_WRITERS: string[] = ["admin", "manager"];

const QUICK: [BoolKey, string][] = [
  ["ai_insights", "Enable AI insights"],
  ["escalation_notifications", "Send escalation notifications"],
  ["auto_followup_overdue", "Auto follow-up for overdue actions"],
  ["email_notifications", "Email notifications"],
  ["sms_notifications", "SMS notifications"],
];

interface ToggleProps {
  label: string;
  detail?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}

function ToggleRow({ label, detail, checked, disabled, onChange }: Readonly<ToggleProps>): JSX.Element {
  return (
    <div className="toggle-row">
      <span><strong>{label}</strong>{detail ? <small>{detail}</small> : null}</span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`switch${checked ? " is-on" : ""}`} onClick={onChange}><span /></button>
    </div>
  );
}

function describe(value: Record<string, unknown>): string {
  const entries = Object.entries(value);
  return entries.length ? entries.map(([key, val]) => `${key}: ${String(val)}`).join(", ") : "—";
}

export function SettingsPage(): JSX.Element {
  const { user } = useAuth();
  const { business } = useBusiness();
  const role = user?.role ?? "viewer";
  const canEdit = SETTINGS_WRITERS.includes(role);
  const isAdmin = role === "admin";

  const [section, setSection] = useState<Section>("Project Configuration");
  const [projectTab, setProjectTab] = useState<ProjectTab>("Project Details");
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"ok" | "error">("ok");
  const tell = (message: string, tone: "ok" | "error" = "ok") => { setNotice(message); setNoticeTone(tone); };

  const settingsData = useApiData<AppSettings>("/settings");
  const [values, setValues] = useState<AppSettings | null>(null);
  const integrations = useApiData<Integration[]>(section === "Integrations" ? "/settings/integrations" : null);
  const users = useApiData<ManagedUser[]>(section === "Users & Roles" ? "/users" : null);
  const rules = useApiData<GovernanceRule[]>(section === "Governance Rules" ? "/governance/rules" : null);
  const lookups = useApiData<Lookups>("/lookups");
  const projects = useApiData<ProjectList>("/projects", { page_size: 100, business });
  const [projectId, setProjectId] = useState("");
  const activeId = projectId || (projects.data?.items[0] ? String(projects.data.items[0].id) : "");
  const detail = useApiData<ProjectDetail>(activeId ? `/projects/${activeId}` : null);
  const milestones = useApiData<MilestoneList>(activeId && projectTab === "Milestones & Dependencies" ? `/projects/${activeId}/milestones` : null);

  useEffect(() => { if (settingsData.data) setValues(settingsData.data); }, [settingsData.data]);

  const [projectForm, setProjectForm] = useState({ name: "", description: "", start: "", end: "", status: "Planning", health: "Good" as HealthRating, owner: "", sponsor: "", business: "" });
  const loaded = detail.data;
  useEffect(() => {
    if (!loaded) return;
    setProjectForm({
      name: loaded.name, description: loaded.description ?? "", start: loaded.start_date ?? "", end: loaded.end_date ?? "",
      status: loaded.status ?? "Planning", health: loaded.health, owner: loaded.owner ?? "", sponsor: loaded.sponsor ?? "", business: loaded.business ?? "",
    });
  }, [loaded]);

  const [recipient, setRecipient] = useState("");
  const [showUser, setShowUser] = useState(false);
  const [userForm, setUserForm] = useState({ username: "", email: "", role: "viewer" as Role, password: "" });
  const [userError, setUserError] = useState("");

  const update = async (patch: Partial<AppSettings>) => {
    if (!values) return;
    const previous = values;
    setValues({ ...values, ...patch });
    try {
      const { data } = await api.patch<AppSettings>("/settings", patch);
      setValues(data);
      tell("Saved.");
      if (section === "Integrations") integrations.reload();
    } catch (error) {
      setValues(previous);
      tell(getApiErrorMessage(error, "Could not save this setting."), "error");
    }
  };

  const flip = (key: BoolKey) => values && void update({ [key]: !values[key] });

  const saveProject = async (fields: Record<string, unknown>, success: string) => {
    try {
      await api.patch(`/projects/${activeId}`, fields);
      tell(success);
      detail.reload();
      projects.reload();
    } catch (error) {
      tell(getApiErrorMessage(error, "Could not save the project."), "error");
    }
  };

  const addRecipient = () => {
    const name = recipient.trim();
    if (!values || !name || values.notification_recipients.includes(name)) { setRecipient(""); return; }
    void update({ notification_recipients: [...values.notification_recipients, name] });
    setRecipient("");
  };

  const createUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUserError("");
    try {
      await api.post("/users", { username: userForm.username.trim(), email: userForm.email.trim() || null, role: userForm.role, password: userForm.password });
      setShowUser(false);
      setUserForm({ username: "", email: "", role: "viewer", password: "" });
      tell("User created.");
      users.reload();
    } catch (error) {
      setUserError(getApiErrorMessage(error, "Could not create this user."));
    }
  };

  const changeUser = async (target: ManagedUser, patch: { role?: Role; is_active?: boolean }) => {
    try {
      await api.patch(`/users/${target.id}`, patch);
      tell("User updated.");
      users.reload();
    } catch (error) {
      tell(getApiErrorMessage(error, "Could not update this user."), "error");
    }
  };

  const toggleRule = async (rule: GovernanceRule) => {
    try {
      await api.patch(`/governance/rules/${rule.id}`, { is_active: !rule.is_active });
      rules.reload();
    } catch (error) {
      tell(getApiErrorMessage(error, "Could not update this rule."), "error");
    }
  };

  if (settingsData.loading && !values) return <section className="feature-page settings-page"><LoadingState label="Loading settings…" /></section>;
  if (!values) return <section className="feature-page settings-page"><ErrorState message={settingsData.error || "Could not load settings."} onRetry={settingsData.reload} /></section>;

  const lifecycle = (lookups.data?.lifecycle_statuses ?? ["Draft", "Planning", "Execution", "On Hold", "Completed", "Cancelled"]) as Lifecycle[];
  const troubled = (detail.data?.metrics.milestones_delayed ?? 0) + (detail.data?.metrics.milestones_at_risk ?? 0);
  const schedule = detail.data?.schedule_status ?? "On track";
  const readOnlyHint = canEdit ? undefined : "Your role can view settings but not change them.";
  const bool = (key: BoolKey) => values[key];

  return (
    <section className="feature-page settings-page">
      <header className="feature-heading"><div><span className="eyebrow">WORKSPACE PREFERENCES</span><h1>Settings</h1><p>Configure project details, ownership, notifications, and workspace preferences.</p></div></header>
      {readOnlyHint ? <Notice message={readOnlyHint} /> : null}
      <Notice message={notice} tone={noticeTone} />

      <div className="settings-layout">
        <nav className="settings-nav feature-card" aria-label="Settings sections">
          {SECTIONS.map((item, index) => (
            <button key={item} type="button" className={section === item ? "is-selected" : ""} onClick={() => { setSection(item); setNotice(""); }}><span aria-hidden="true">{SECTION_ICONS[index]}</span>{item}</button>
          ))}
        </nav>

        <div className="settings-main">
          {section === "Project Configuration" ? (
            <>
              <div className="settings-project-picker">
                <label>Project
                  <select aria-label="Project" value={activeId} onChange={(event) => setProjectId(event.target.value)}>
                    {(projects.data?.items ?? []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                  </select>
                </label>
              </div>
              {!activeId && projects.data ? <p className="pl-state">No projects yet. Create a project first.</p> : null}
              {detail.error ? <ErrorState message={detail.error} onRetry={detail.reload} /> : null}
              {detail.data ? (
                <>
                  <nav className="settings-tabs" aria-label="Project setting tabs">
                    {PROJECT_TABS.map((item) => <button key={item} type="button" className={projectTab === item ? "is-selected" : ""} onClick={() => setProjectTab(item)}>{item}</button>)}
                  </nav>
                  <div className="settings-project-grid">
                    <section className="feature-card settings-panel">
                      {projectTab === "Project Details" ? (
                        <form
                          className="settings-form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void saveProject({
                              name: projectForm.name.trim(), description: projectForm.description.trim() || null,
                              start_date: projectForm.start, end_date: projectForm.end, status: projectForm.status, health: projectForm.health,
                            }, "Project details saved.");
                          }}
                        >
                          <h2>Project Information</h2>
                          <label>Project name<input required minLength={2} maxLength={200} disabled={!canEdit} value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} /></label>
                          <label>Description<textarea rows={3} maxLength={500} disabled={!canEdit} value={projectForm.description} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })} /></label>
                          <div className="form-row">
                            <label>Start date<input required type="date" disabled={!canEdit} value={projectForm.start} onChange={(event) => setProjectForm({ ...projectForm, start: event.target.value })} /></label>
                            <label>Planned end date<input required type="date" min={projectForm.start || undefined} disabled={!canEdit} value={projectForm.end} onChange={(event) => setProjectForm({ ...projectForm, end: event.target.value })} /></label>
                          </div>
                          <div className="form-row">
                            <label>Status<select disabled={!canEdit} value={projectForm.status} onChange={(event) => setProjectForm({ ...projectForm, status: event.target.value })}>{lifecycle.map((item) => <option key={item}>{item}</option>)}</select></label>
                            <label>Health<select disabled={!canEdit} value={projectForm.health} onChange={(event) => setProjectForm({ ...projectForm, health: event.target.value as HealthRating })}>{HEALTH.map((item) => <option key={item}>{item}</option>)}</select></label>
                          </div>
                          {canEdit ? (
                            <div className="modal-actions settings-form-actions">
                              <button type="button" className="secondary-button" onClick={() => detail.reload()}>Reset</button>
                              <button type="submit" className="primary-button">Save Changes</button>
                            </div>
                          ) : null}
                        </form>
                      ) : null}

                      {projectTab === "Milestones & Dependencies" ? (
                        <div className="settings-list-panel">
                          <div className="feature-card-heading"><div><h2>Milestones &amp; dependencies</h2><p>The live schedule for this project.</p></div></div>
                          {milestones.loading && !milestones.data ? <LoadingState /> : null}
                          <div className="milestone-settings-list">
                            {(milestones.data?.items ?? []).map((item, index) => (
                              <article key={item.id}><span className="milestone-index">{String(index + 1).padStart(2, "0")}</span><div><strong>{item.name}</strong><small>{item.owner ?? "Unassigned"} · {formatDate(item.due_date)}</small></div><Pill value={item.status} /></article>
                            ))}
                          </div>
                          {milestones.data && !milestones.data.items.length ? <p className="pl-muted">No milestones yet.</p> : null}
                          <p className="settings-links"><Link to={`/projects/${activeId}/milestones`}>Manage milestones →</Link> <Link to={`/dependencies?project_id=${activeId}`}>Manage dependencies →</Link></p>
                        </div>
                      ) : null}

                      {projectTab === "Owners" ? (
                        <form
                          className="settings-list-panel"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void saveProject({ owner: projectForm.owner.trim(), sponsor: projectForm.sponsor.trim() || null, business: projectForm.business.trim() || null }, "Owners saved.");
                          }}
                        >
                          <h2>Project owners</h2>
                          <label className="owner-setting-row">Project manager<input required list="settings-owners" disabled={!canEdit} value={projectForm.owner} onChange={(event) => setProjectForm({ ...projectForm, owner: event.target.value })} /></label>
                          <label className="owner-setting-row">Sponsor<input list="settings-owners" disabled={!canEdit} value={projectForm.sponsor} onChange={(event) => setProjectForm({ ...projectForm, sponsor: event.target.value })} /></label>
                          <label className="owner-setting-row">Business unit<input list="settings-businesses" disabled={!canEdit} value={projectForm.business} onChange={(event) => setProjectForm({ ...projectForm, business: event.target.value })} /></label>
                          <datalist id="settings-owners">{(lookups.data?.owners ?? []).map((name) => <option key={name} value={name} />)}</datalist>
                          <datalist id="settings-businesses">{(lookups.data?.businesses ?? []).map((name) => <option key={name} value={name} />)}</datalist>
                          {canEdit ? <button type="submit" className="primary-button">Save owner changes</button> : null}
                        </form>
                      ) : null}

                      {projectTab === "Advanced Settings" ? (
                        <div className="settings-list-panel">
                          <h2>Advanced project settings</h2>
                          <label>Project code<input readOnly value={detail.data.code ?? ""} /></label>
                          <label>Reporting timezone
                            <select disabled={!canEdit} value={values.reporting_timezone} onChange={(event) => void update({ reporting_timezone: event.target.value })}>
                              {["Asia/Kolkata", "UTC", "America/Chicago", "Europe/London"].map((zone) => <option key={zone}>{zone}</option>)}
                            </select>
                          </label>
                          <ToggleRow label="AI agents for this project" detail="Agents run tasks and ask for approval when required." checked={detail.data.ai_agents_enabled} disabled={!canEdit} onChange={() => void saveProject({ ai_agents_enabled: !detail.data?.ai_agents_enabled }, "AI agent setting saved.")} />
                          <ToggleRow label="Automatically flag overdue milestones" checked={bool("notify_overdue_milestones")} disabled={!canEdit} onChange={() => flip("notify_overdue_milestones")} />
                          <ToggleRow label="Require an owner for every action" checked={bool("require_action_owner")} disabled={!canEdit} onChange={() => flip("require_action_owner")} />
                        </div>
                      ) : null}
                    </section>

                    <section className="feature-card settings-milestones-panel">
                      <div className="feature-card-heading"><div><h2>Project snapshot</h2><p>Live from the database</p></div></div>
                      <div className="settings-milestone-table">
                        <article><strong>Progress</strong><span>{detail.data.progress}%</span><small>{detail.data.metrics.milestones_total} milestones</small><span /></article>
                        <article><strong>Budget</strong><span>{detail.data.metrics.budget_spent_pct}%</span><small>spent</small><span /></article>
                        <article><strong>Open risks</strong><span>{detail.data.metrics.risks_high + detail.data.metrics.risks_medium + detail.data.metrics.risks_low}</span><small>{detail.data.metrics.risks_high} high</small><span /></article>
                        <article><strong>Open actions</strong><span>{detail.data.metrics.actions_open}</span><small>{detail.data.metrics.actions_overdue} overdue</small><span /></article>
                      </div>
                    </section>
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {section === "Users & Roles" ? (
            <section className="feature-card settings-section-card">
              <div className="feature-card-heading">
                <div><h2>Users &amp; roles</h2><p>Accounts that can sign in to this workspace.</p></div>
                {isAdmin ? <button type="button" className="primary-button" onClick={() => { setUserError(""); setShowUser(true); }}>＋ Add user</button> : null}
              </div>
              {users.error ? <ErrorState message={users.error} onRetry={users.reload} /> : null}
              {users.loading && !users.data ? <LoadingState /> : null}
              <div className="responsive-table-wrap">
                <table className="feature-table">
                  <thead><tr><th>User</th><th>Role</th><th>Status</th></tr></thead>
                  <tbody>
                    {(users.data ?? []).map((account) => {
                      const self = account.username === user?.username;
                      return (
                        <tr key={account.id}>
                          <td><strong>{account.username}</strong><br /><small>{account.email ?? "No email"}</small></td>
                          <td>
                            {isAdmin ? (
                              <select aria-label={`Role for ${account.username}`} value={account.role} disabled={self} onChange={(event) => void changeUser(account, { role: event.target.value as Role })}>{ROLES.map((item) => <option key={item}>{item}</option>)}</select>
                            ) : account.role}
                          </td>
                          <td>
                            <Pill value={account.is_active ? "Active" : "Inactive"} />
                            {isAdmin && !self ? <button type="button" className="table-action-button" onClick={() => void changeUser(account, { is_active: !account.is_active })}>{account.is_active ? "Deactivate" : "Activate"}</button> : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!isAdmin ? <p className="pl-muted">Only administrators can add or change users.</p> : null}
            </section>
          ) : null}

          {section === "Notifications" ? (
            <section className="feature-card settings-section-card">
              <h2>Notification preferences</h2>
              <p className="muted">Choose which project events should notify your team. Delivery by email or SMS is not connected yet, so these preferences are stored for when it is.</p>
              <div className="toggle-settings-list">
                {([["email_notifications", "Email notifications"], ["sms_notifications", "SMS notifications"], ["escalation_notifications", "Send escalation notifications"], ["daily_summary_email", "Daily summary email"], ["notify_overdue_milestones", "Notify on overdue milestones"]] as [BoolKey, string][]).map(([key, label]) => (
                  <ToggleRow key={key} label={label} checked={bool(key)} disabled={!canEdit} onChange={() => flip(key)} />
                ))}
              </div>
              <div className="recipient-manager">
                <h3>Notification recipients</h3>
                <div className="recipient-chips">
                  {values.notification_recipients.map((name) => (
                    <button type="button" key={name} disabled={!canEdit} title={`Remove ${name}`} onClick={() => void update({ notification_recipients: values.notification_recipients.filter((item) => item !== name) })}>{name}<span aria-hidden="true"> ×</span></button>
                  ))}
                </div>
                {canEdit ? (
                  <div className="inline-add-row">
                    <input value={recipient} maxLength={100} onChange={(event) => setRecipient(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addRecipient(); } }} placeholder="Add a person or team" aria-label="Add notification recipient" />
                    <button type="button" className="secondary-button" onClick={addRecipient}>Add recipient</button>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {section === "Governance Rules" ? (
            <section className="feature-card settings-section-card">
              <h2>Governance rules</h2>
              <p className="muted">Rules from the governance table. Switching a rule off stops it from being evaluated.</p>
              {rules.error ? <ErrorState message={rules.error} onRetry={rules.reload} /> : null}
              {rules.loading && !rules.data ? <LoadingState /> : null}
              <div className="responsive-table-wrap">
                <table className="feature-table">
                  <thead><tr><th>Rule</th><th>Category</th><th>Severity</th><th>Condition</th><th>Action</th><th>Active</th></tr></thead>
                  <tbody>
                    {(rules.data ?? []).map((rule) => (
                      <tr key={rule.id}>
                        <td><strong>{rule.name}</strong><br /><small>{rule.code}</small></td>
                        <td>{rule.category ?? "—"}</td><td>{rule.severity ?? "—"}</td>
                        <td><small>{describe(rule.condition)}</small></td><td><small>{describe(rule.action)}</small></td>
                        <td><button type="button" role="switch" aria-checked={rule.is_active} aria-label={`Rule ${rule.code ?? rule.id} active`} disabled={!isAdmin} className={`switch${rule.is_active ? " is-on" : ""}`} onClick={() => void toggleRule(rule)}><span /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3>Review policy</h3>
              <div className="toggle-settings-list">
                {([["require_high_risk_approval", "Require approval for high risks", "High severity issues must be reviewed before closure."], ["auto_followup_overdue", "Auto follow-up for overdue actions", "Create a follow-up when a due date is missed."], ["two_person_approval", "Enable two-person milestone approval", "Require a second reviewer on critical milestones."], ["require_action_owner", "Require an owner for every action", "Keep all open actions assigned to a person or team."]] as [BoolKey, string, string][]).map(([key, label, detail]) => (
                  <ToggleRow key={key} label={label} detail={detail} checked={bool(key)} disabled={!canEdit} onChange={() => flip(key)} />
                ))}
              </div>
              <label className="settings-select-row">Escalate overdue items after
                <select disabled={!canEdit} value={values.escalate_after} onChange={(event) => void update({ escalate_after: event.target.value })}>{["1 day", "2 days", "3 days", "1 week"].map((item) => <option key={item}>{item}</option>)}</select>
              </label>
            </section>
          ) : null}

          {section === "Integrations" ? (
            <section className="feature-card settings-section-card">
              <h2>Integrations</h2>
              <p className="muted">Live status of the connected services.</p>
              {integrations.error ? <ErrorState message={integrations.error} onRetry={integrations.reload} /> : null}
              {integrations.loading && !integrations.data ? <LoadingState /> : null}
              <div className="integration-list">
                {(integrations.data ?? []).map((item) => {
                  const key: BoolKey | null = item.name === "Email" ? "email_notifications" : item.name === "AI insights" ? "ai_insights" : null;
                  return (
                    <article key={item.name}>
                      <span className="integration-icon">{item.name === "Database" ? "▤" : item.name === "Email" ? "✉" : "✦"}</span>
                      <div><strong>{item.name}</strong><small>{item.detail}</small></div>
                      <Pill value={item.status} />
                      {key ? <button type="button" className="secondary-button" disabled={!canEdit} onClick={() => flip(key)}>{item.status === "Enabled" ? "Disable" : "Enable"}</button> : <span />}
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {section === "System Preferences" ? (
            <section className="feature-card settings-section-card">
              <h2>System preferences</h2>
              <p className="muted">Personalize how dates, reports, and the interface are shown.</p>
              <label className="settings-select-row">Date format<select disabled={!canEdit} value={values.date_format} onChange={(event) => void update({ date_format: event.target.value })}>{["DD MMM YYYY", "MM/DD/YYYY", "YYYY-MM-DD"].map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="settings-select-row">Default report period<select disabled={!canEdit} value={values.default_report_period} onChange={(event) => void update({ default_report_period: event.target.value })}>{["Daily", "Weekly", "Monthly", "Yearly"].map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="settings-select-row">Dashboard refresh<select disabled={!canEdit} value={values.dashboard_refresh} onChange={(event) => void update({ dashboard_refresh: event.target.value })}>{["Manual", "Every 5 minutes", "Every 15 minutes"].map((item) => <option key={item}>{item}</option>)}</select></label>
              <ToggleRow label="Enable AI insights" checked={bool("ai_insights")} disabled={!canEdit} onChange={() => flip("ai_insights")} />
            </section>
          ) : null}
        </div>

        <aside className="settings-quick-column">
          <section className="feature-card quick-settings-card">
            <h2>Quick settings</h2>
            {QUICK.map(([key, label]) => <ToggleRow key={key} label={label} checked={bool(key)} disabled={!canEdit} onChange={() => flip(key)} />)}
            <button type="button" className="text-action" onClick={() => setSection("Notifications")}>Notification settings <span aria-hidden="true">→</span></button>
          </section>
          {detail.data ? (
            <section className={`project-health-callout project-health-${schedule.toLowerCase().replace(" ", "-")}`}>
              <span className="health-alert-icon" aria-hidden="true">!</span>
              <div>
                <strong>{detail.data.name} is currently<br /><b>{schedule.toUpperCase()}</b></strong>
                <small>{troubled} milestone(s) need attention.</small>
                <button type="button" onClick={() => setSection("Governance Rules")}>View governance rules <span aria-hidden="true">→</span></button>
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      {showUser ? (
        <Modal eyebrow="USERS & ROLES" title="Add a user" onClose={() => setShowUser(false)}>
          <form className="feature-form" onSubmit={(event) => void createUser(event)}>
            <label>Username<input required minLength={3} maxLength={100} pattern="[A-Za-z0-9._\-]+" value={userForm.username} onChange={(event) => setUserForm({ ...userForm, username: event.target.value })} /></label>
            <label>Email<input type="email" maxLength={200} value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></label>
            <label>Role<select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value as Role })}>{ROLES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Temporary password<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} /></label>
            <p className="pl-muted">At least 8 characters with upper and lower case letters, a number and a symbol.</p>
            {userError ? <p className="wiz-error" role="alert">{userError}</p> : null}
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowUser(false)}>Cancel</button><button type="submit" className="primary-button">Create user</button></div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
