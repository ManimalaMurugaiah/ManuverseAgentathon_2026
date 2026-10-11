import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../api/client";
import { getApiErrorMessage } from "../api/errors";
import { Modal } from "../components/Modal";
import { ProgressBar, StatusPill, barTone, formatDate } from "../components/ProjectUi";
import { useAuth } from "../context/AuthContext";
import type { Project, ProjectHealth, ProjectList } from "../types";

const PAGE_SIZE = 6;
const HEALTH_OPTIONS: ProjectHealth[] = ["On track", "At risk", "Delayed"];

interface ProjectForm {
  name: string;
  code: string;
  owner: string;
  country: string;
  plant: string;
  budget: string;
  start_date: string;
  end_date: string;
  ai_agents_enabled: boolean;
}

const emptyForm: ProjectForm = {
  name: "",
  code: "",
  owner: "",
  country: "",
  plant: "",
  budget: "",
  start_date: "",
  end_date: "",
  ai_agents_enabled: true,
};

function CreateProjectModal({ defaultOwner, onClose, onCreated }: Readonly<{ defaultOwner: string; onClose: () => void; onCreated: () => void }>): JSX.Element {
  const [form, setForm] = useState<ProjectForm>({ ...emptyForm, owner: defaultOwner });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.end_date < form.start_date) {
      setError("End date must not be before the start date.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post("/projects", {
        name: form.name.trim(),
        code: form.code.trim() || null,
        owner: form.owner.trim(),
        country: form.country.trim() || null,
        plant: form.plant.trim() || null,
        budget: form.budget === "" ? null : form.budget,
        start_date: form.start_date,
        end_date: form.end_date,
        ai_agents_enabled: form.ai_agents_enabled,
      });
      onCreated();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not create the project. Check the details and try again."));
      setSaving(false);
    }
  };

  return (
    <Modal eyebrow="NEW PROJECT" title="Create a project" onClose={onClose}>
      <form className="feature-form" onSubmit={(event) => void submit(event)}>
        <label>
          Project name
          <input required minLength={2} maxLength={200} value={form.name} onChange={(e) => update("name", e.target.value)} />
        </label>
        <div className="form-row">
          <label>
            Owner
            <input required maxLength={100} value={form.owner} onChange={(e) => update("owner", e.target.value)} />
          </label>
          <label>
            Project code (optional)
            <input maxLength={50} pattern="[A-Za-z0-9_\-]*" placeholder="Auto-generated" value={form.code} onChange={(e) => update("code", e.target.value)} />
          </label>
        </div>
        <div className="form-row">
          <label>
            Start date
            <input required type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} />
          </label>
          <label>
            End date
            <input required type="date" min={form.start_date || undefined} value={form.end_date} onChange={(e) => update("end_date", e.target.value)} />
          </label>
        </div>
        <div className="form-row">
          <label>
            Country
            <input maxLength={100} value={form.country} onChange={(e) => update("country", e.target.value)} />
          </label>
          <label>
            Plant
            <input maxLength={100} value={form.plant} onChange={(e) => update("plant", e.target.value)} />
          </label>
        </div>
        <label>
          Budget
          <input type="number" min={0} step="0.01" value={form.budget} onChange={(e) => update("budget", e.target.value)} />
        </label>
        <label className="pj-check">
          <input type="checkbox" checked={form.ai_agents_enabled} onChange={(e) => update("ai_agents_enabled", e.target.checked)} />
          Enable AI agents for this project
        </label>
        {error ? <p className="pj-alert" role="alert">{error}</p> : null}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button" disabled={saving}>{saving ? "Creating…" : "Create project"}</button>
        </div>
      </form>
    </Modal>
  );
}

export function ProjectsPage(): JSX.Element {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canWrite = user?.role === "admin" || user?.role === "manager";

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState<ProjectHealth | "">("");
  const [owner, setOwner] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ProjectList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<ProjectList>("/projects", { params: { search: query || undefined, health: health || undefined, owner: owner || undefined, page, page_size: PAGE_SIZE } })
      .then(({ data: result }) => {
        if (!active) return;
        setData(result);
        setError("");
      })
      .catch((err: unknown) => {
        if (active) setError(getApiErrorMessage(err, "Could not load projects."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, health, owner, page, reloadKey]);

  const toggleAgents = useCallback(async (project: Project) => {
    try {
      const { data: updated } = await api.patch<Project>(`/projects/${project.id}`, { ai_agents_enabled: !project.ai_agents_enabled });
      setData((current) => (current ? { ...current, items: current.items.map((item) => (item.id === updated.id ? updated : item)) } : current));
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not update AI agents."));
    }
  }, []);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);

  return (
    <section className="feature-page pj-page">
      <header className="feature-heading">
        <div>
          <h1>Projects</h1>
          <p>Manage all projects across the organization</p>
        </div>
        {canWrite ? (
          <button type="button" className="primary-button" onClick={() => setShowCreate(true)}>
            <span aria-hidden="true">＋</span> Create project
          </button>
        ) : null}
      </header>

      <div className="pj-toolbar">
        <label className="pj-search">
          <span aria-hidden="true">⌕</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects" aria-label="Search projects" maxLength={100} />
        </label>
        <select className="pj-select" aria-label="Filter by status" value={health} onChange={(e) => { setHealth(e.target.value as ProjectHealth | ""); setPage(1); }}>
          <option value="">All status</option>
          {HEALTH_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select className="pj-select" aria-label="Filter by owner" value={owner} onChange={(e) => { setOwner(e.target.value); setPage(1); }}>
          <option value="">All owners</option>
          {(data?.owners ?? []).map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>

      <div className="pj-card">
        {error ? <p className="pj-state is-error" role="alert">{error}</p> : null}
        <div className="responsive-table-wrap">
          <table className="pj-table">
            <thead>
              <tr>
                <th>Project name</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Owner</th>
                <th>Start date</th>
                <th>End date</th>
                <th>AI agents</th>
              </tr>
            </thead>
            <tbody>
              {items.map((project) => (
                <tr key={project.id} className="is-clickable" onClick={() => navigate(`/projects/${project.id}/milestones`)}>
                  <td>
                    <Link className="pj-name" to={`/projects/${project.id}/milestones`} onClick={(e) => e.stopPropagation()}>
                      <span className="pj-avatar" aria-hidden="true">{project.name.charAt(0).toUpperCase()}</span>
                      {project.name}
                    </Link>
                  </td>
                  <td><StatusPill status={project.health} /></td>
                  <td><ProgressBar value={project.progress} tone={barTone(project.health)} /></td>
                  <td>{project.owner ?? "—"}</td>
                  <td>{formatDate(project.start_date)}</td>
                  <td>{formatDate(project.end_date)}</td>
                  <td>
                    <button
                      type="button"
                      className={`pj-agent ${project.ai_agents_enabled ? "" : "is-off"}`}
                      disabled={!canWrite}
                      aria-label={`AI agents ${project.ai_agents_enabled ? "enabled" : "off"} for ${project.name}`}
                      onClick={(e) => { e.stopPropagation(); void toggleAgents(project); }}
                    >
                      {project.ai_agents_enabled ? "Enabled" : "Off"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && items.length === 0 ? <p className="pj-state">Loading projects…</p> : null}
        {!loading && !error && items.length === 0 ? <p className="pj-state">No projects match your filters.</p> : null}
        <div className="pj-footer">
          <span>Showing {first}–{last} of {total} projects</span>
          <div className="pj-pager">
            <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
              <button key={number} type="button" className={number === page ? "is-current" : ""} aria-current={number === page ? "page" : undefined} onClick={() => setPage(number)}>{number}</button>
            ))}
            <button type="button" aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>›</button>
          </div>
        </div>
      </div>

      {canWrite ? (
        <aside className="pj-banner is-green">
          <span className="pj-banner-icon" aria-hidden="true">✦</span>
          <div>
            <strong>Start a project</strong>
            <span>Define scope, team and timeline, then enable AI agents.</span>
          </div>
          <button type="button" className="secondary-button" onClick={() => setShowCreate(true)}>Open project wizard</button>
        </aside>
      ) : null}

      {showCreate ? (
        <CreateProjectModal
          defaultOwner={user?.username ?? ""}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            setSearch("");
            setQuery("");
            setHealth("");
            setOwner("");
            setPage(1);
            setReloadKey((key) => key + 1);
          }}
        />
      ) : null}
    </section>
  );
}
