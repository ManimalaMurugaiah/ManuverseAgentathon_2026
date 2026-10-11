import { useMemo, useState } from "react";

type ProjectStatus = "On track" | "At risk" | "Delayed";

interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  progress: number;
  owner: string;
  startDate: string;
  endDate: string;
  agentsEnabled: boolean;
}

const initialProjects: Project[] = [
  { id: "PRJ-001", name: "Alpha – Expansion Plant", status: "On track", progress: 70, owner: "Ravi K.", startDate: "10 Oct 2026", endDate: "20 Dec 2026", agentsEnabled: true },
  { id: "PRJ-002", name: "Vendor Manufacturing", status: "At risk", progress: 45, owner: "Anita S.", startDate: "20 Oct 2026", endDate: "15 Jan 2027", agentsEnabled: true },
  { id: "PRJ-003", name: "Plant Engineering Upgrade", status: "Delayed", progress: 20, owner: "Michael T.", startDate: "20 Oct 2026", endDate: "28 Feb 2027", agentsEnabled: true },
  { id: "PRJ-004", name: "Digital Twin Implementation", status: "On track", progress: 55, owner: "Ravi K.", startDate: "10 Oct 2026", endDate: "30 Nov 2026", agentsEnabled: true },
  { id: "PRJ-005", name: "Sustainability Initiative", status: "On track", progress: 30, owner: "Rita S.", startDate: "20 Oct 2026", endDate: "31 Mar 2027", agentsEnabled: false },
  { id: "PRJ-006", name: "Supplier Onboarding", status: "At risk", progress: 38, owner: "Priya S.", startDate: "01 Nov 2026", endDate: "15 Feb 2027", agentsEnabled: false },
  { id: "PRJ-007", name: "Northstar Rolling Mill Modernization", status: "On track", progress: 62, owner: "Meera S.", startDate: "05 Sep 2026", endDate: "15 Apr 2027", agentsEnabled: true },
  { id: "PRJ-008", name: "Precision CNC Cell Expansion", status: "At risk", progress: 41, owner: "Anita R.", startDate: "18 Sep 2026", endDate: "10 May 2027", agentsEnabled: true },
  { id: "PRJ-009", name: "Evergreen Packaging Line 3", status: "On track", progress: 76, owner: "Priya N.", startDate: "01 Aug 2026", endDate: "28 Dec 2026", agentsEnabled: false },
  { id: "PRJ-010", name: "Summit Pump Test Facility", status: "Delayed", progress: 24, owner: "Daniel L.", startDate: "12 Sep 2026", endDate: "30 Jun 2027", agentsEnabled: true },
  { id: "PRJ-011", name: "Factory Energy Optimization", status: "On track", progress: 53, owner: "Rita S.", startDate: "01 Oct 2026", endDate: "31 May 2027", agentsEnabled: true },
  { id: "PRJ-012", name: "Quality Systems Upgrade", status: "At risk", progress: 35, owner: "Michael T.", startDate: "15 Oct 2026", endDate: "15 Mar 2027", agentsEnabled: false },
];

const pageSize = 6;

function statusClass(status: ProjectStatus): string {
  return status === "On track" ? "project-status--on-track" : status === "At risk" ? "project-status--at-risk" : "project-status--delayed";
}

function dateLabel(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function ProjectsPage(): JSX.Element {
  const [projects, setProjects] = useState(initialProjects);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All status");
  const [ownerFilter, setOwnerFilter] = useState("All owners");
  const [page, setPage] = useState(1);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [agentsEnabled, setAgentsEnabled] = useState(true);
  const owners = useMemo(() => [...new Set(projects.map((project) => project.owner))], [projects]);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesQuery = !normalizedQuery || `${project.name} ${project.id} ${project.owner}`.toLowerCase().includes(normalizedQuery);
      const matchesStatus = statusFilter === "All status" || project.status === statusFilter;
      const matchesOwner = ownerFilter === "All owners" || project.owner === ownerFilter;
      return matchesQuery && matchesStatus && matchesOwner;
    });
  }, [ownerFilter, projects, query, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredProjects.length / pageSize));
  const visibleProjects = filteredProjects.slice((page - 1) * pageSize, page * pageSize);
  const rangeStart = filteredProjects.length ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(page * pageSize, filteredProjects.length);

  const updateFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  const createProject = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const project: Project = {
      id: `PRJ-${String(Date.now()).slice(-3)}`,
      name: name.trim(),
      status: "On track",
      progress: 0,
      owner: owner.trim(),
      startDate: dateLabel(startDate),
      endDate: dateLabel(endDate),
      agentsEnabled,
    };
    setProjects((current) => [project, ...current]);
    setQuery("");
    setStatusFilter("All status");
    setOwnerFilter("All owners");
    setPage(1);
    setCreateOpen(false);
    setName("");
    setOwner("");
    setStartDate("");
    setEndDate("");
    setAgentsEnabled(true);
  };

  const toggleAgents = (project: Project) => {
    setProjects((current) => current.map((item) =>
      item.id === project.id ? { ...item, agentsEnabled: !item.agentsEnabled } : item,
    ));
  };

  return (
    <section className="projects-page">
      <header className="projects-heading">
        <div><h1>Projects</h1><p>Manage all projects across the organization</p></div>
        <button type="button" className="projects-create-button" onClick={() => setCreateOpen(true)}>＋ Create project</button>
      </header>

      <section className="projects-table-card" aria-label="Project register">
        <div className="projects-toolbar">
          <label className="projects-search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Search projects"
              placeholder="Search projects"
              value={query}
              onChange={(event) => updateFilter(setQuery, event.target.value)}
            />
            {query ? <button type="button" aria-label="Clear project search" onClick={() => updateFilter(setQuery, "")}>×</button> : null}
          </label>
          <label className="projects-filter">
            <span className="visually-hidden">Filter by status</span>
            <select aria-label="Filter by status" value={statusFilter} onChange={(event) => updateFilter(setStatusFilter, event.target.value)}>
              <option>All status</option><option>On track</option><option>At risk</option><option>Delayed</option>
            </select>
          </label>
          <label className="projects-filter">
            <span className="visually-hidden">Filter by owner</span>
            <select aria-label="Filter by owner" value={ownerFilter} onChange={(event) => updateFilter(setOwnerFilter, event.target.value)}>
              <option>All owners</option>
              {owners.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
        </div>

        <div className="projects-table-scroll">
          <table className="projects-table">
            <thead>
              <tr><th>Project name</th><th>Status</th><th>Progress</th><th>Owner</th><th>Start date</th><th>End date</th><th>AI agents</th></tr>
            </thead>
            <tbody>
              {visibleProjects.map((project) => (
                <tr key={project.id}>
                  <td>
                    <button type="button" className="project-name-button" onClick={() => setSelectedProject(project)}>
                      <span className="project-initial">{project.name.charAt(0).toUpperCase()}</span>
                      <span><strong>{project.name}</strong><small>{project.id}</small></span>
                    </button>
                  </td>
                  <td><span className={`project-status ${statusClass(project.status)}`}>{project.status}</span></td>
                  <td>
                    <div className="project-progress">
                      <span className="project-progress-track"><span className={`project-progress-value ${statusClass(project.status)}`} style={{ width: `${project.progress}%` }} /></span>
                      <strong>{project.progress}%</strong>
                    </div>
                  </td>
                  <td>{project.owner}</td><td>{project.startDate}</td><td>{project.endDate}</td>
                  <td>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={project.agentsEnabled}
                      aria-label={`${project.agentsEnabled ? "Disable" : "Enable"} AI agents for ${project.name}`}
                      className={`project-agent-toggle${project.agentsEnabled ? " is-enabled" : ""}`}
                      onClick={() => toggleAgents(project)}
                    >
                      {project.agentsEnabled ? "Enabled" : "Off"}
                    </button>
                  </td>
                </tr>
              ))}
              {!visibleProjects.length ? <tr><td colSpan={7} className="projects-empty">No projects match these filters.</td></tr> : null}
            </tbody>
          </table>
        </div>

        <footer className="projects-table-footer">
          <span>Showing {rangeStart}–{rangeEnd} of {filteredProjects.length} projects</span>
          <nav className="projects-pagination" aria-label="Project pages">
            <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>‹</button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
              <button
                type="button"
                key={pageNumber}
                aria-label={`Page ${pageNumber}`}
                aria-current={page === pageNumber ? "page" : undefined}
                className={page === pageNumber ? "is-current" : ""}
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
            <button type="button" aria-label="Next page" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>›</button>
          </nav>
        </footer>
      </section>

      {createOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false); }}>
          <section className="feature-modal projects-modal" role="dialog" aria-modal="true" aria-labelledby="create-project-title">
            <div className="modal-heading">
              <div><span className="eyebrow">PROJECT SETUP</span><h2 id="create-project-title">Create a project</h2></div>
              <button type="button" className="modal-close" aria-label="Close project wizard" onClick={() => setCreateOpen(false)}>×</button>
            </div>
            <form className="feature-form" onSubmit={createProject}>
              <label>Project name<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Factory expansion" /></label>
              <label>Project owner<input required maxLength={60} value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Name or team" /></label>
              <div className="form-row">
                <label>Start date<input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
                <label>End date<input required type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
              </div>
              <label className="project-agent-option"><input type="checkbox" checked={agentsEnabled} onChange={(event) => setAgentsEnabled(event.target.checked)} /> Enable AI agents for this project</label>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setCreateOpen(false)}>Cancel</button>
                <button type="submit" className="projects-create-button">Create project</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {selectedProject ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedProject(null); }}>
          <section className="feature-modal projects-modal" role="dialog" aria-modal="true" aria-labelledby="project-detail-title">
            <div className="modal-heading">
              <div><span className="eyebrow">{selectedProject.id}</span><h2 id="project-detail-title">{selectedProject.name}</h2></div>
              <button type="button" className="modal-close" aria-label="Close project details" onClick={() => setSelectedProject(null)}>×</button>
            </div>
            <div className="project-detail-grid">
              <div><span>Status</span><strong>{selectedProject.status}</strong></div>
              <div><span>Progress</span><strong>{selectedProject.progress}%</strong></div>
              <div><span>Owner</span><strong>{selectedProject.owner}</strong></div>
              <div><span>Start date</span><strong>{selectedProject.startDate}</strong></div>
              <div><span>End date</span><strong>{selectedProject.endDate}</strong></div>
              <div><span>AI agents</span><strong>{selectedProject.agentsEnabled ? "Enabled" : "Off"}</strong></div>
            </div>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setSelectedProject(null)}>Close</button></div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
