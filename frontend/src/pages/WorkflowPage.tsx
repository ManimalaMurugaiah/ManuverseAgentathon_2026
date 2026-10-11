import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import api from "../api/client";
import { getApiErrorMessage } from "../api/errors";
import { useAuth } from "../context/AuthContext";
import type { Role, WorkflowRun } from "../types";

interface WorkflowLog {
  agent_name: string;
  action: string;
  status: string;
  details: string;
  created_at: string;
}

const canStart = (role: Role | undefined) => role === "admin" || role === "manager" || role === "engineering";
const canApprove = (role: Role | undefined) => role === "admin" || role === "manager" || role === "approver";

export function WorkflowPage(): JSX.Element {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const selectedProject = searchParams.get("project_code") ?? "";
  const [projectCode, setProjectCode] = useState(selectedProject || "PRJ-001");
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [logs, setLogs] = useState<WorkflowLog[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setProjectCode(selectedProject || "PRJ-001");
  }, [selectedProject]);

  useEffect(() => {
    let active = true;
    const params = selectedProject ? { project_code: selectedProject } : undefined;

    api.get<WorkflowRun[]>("/workflow/runs", { params: { ...params, limit: 100 } })
      .then(({ data }) => {
        if (!active) return;
        setRuns(data);
        if (run) {
          const refreshed = data.find((item) => item.id === run.id);
          if (refreshed) setRun(refreshed);
        }
        setError("");
      })
      .catch((loadError: unknown) => {
        if (active) setError(getApiErrorMessage(loadError, "Could not load workflow runs."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedProject, run?.id]);

  useEffect(() => {
    let active = true;
    if (!run) {
      setLogs([]);
      return () => {
        active = false;
      };
    }

    api.get<WorkflowLog[]>(`/workflow/runs/${run.id}/logs`)
      .then(({ data }) => {
        if (active) setLogs(data);
      })
      .catch((loadError: unknown) => {
        if (active) setError(getApiErrorMessage(loadError, "Could not load workflow history."));
      });

    return () => {
      active = false;
    };
  }, [run?.id]);

  const startRun = async () => {
    setError("");
    setWorking(true);
    try {
      const { data } = await api.post<WorkflowRun>("/workflow/runs", { project_code: projectCode.trim() });
      setRun(data);
      setRuns((current) => [data, ...current.filter((item) => item.id !== data.id)]);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Could not start this workflow run."));
    } finally {
      setWorking(false);
    }
  };

  const step = async (approved: boolean) => {
    if (!run) return;
    setError("");
    setWorking(true);
    try {
      const { data } = await api.post<WorkflowRun>("/workflow/step", {
        run_id: run.id,
        approved,
        note,
      });
      setRun(data);
      setRuns((current) => current.map((item) => item.id === data.id ? data : item));
      setNote("");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Could not update this workflow run."));
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className="workflow-page">
      <header className="page-heading">
        <div>
          <h1>Workflow Control</h1>
          <p className="page-subtitle">Create, review, and advance persisted workflow runs.</p>
        </div>
      </header>

      {error ? <div className="dashboard-error" role="alert">{error}</div> : null}

      {canStart(user?.role) ? (
        <div className="panel workflow-start-panel">
          <label>
            Project Code
            <input value={projectCode} onChange={(event) => setProjectCode(event.target.value)} maxLength={64} />
          </label>
          <button onClick={() => void startRun()} disabled={working || !projectCode.trim()}>
            {working ? "Working…" : "Start Run"}
          </button>
        </div>
      ) : null}

      <div className="workflow-content-grid">
        <section className="panel">
          <h2>Workflow Runs</h2>
          {loading ? <p className="muted">Loading workflow runs…</p> : null}
          {!loading && runs.length === 0 ? <p className="muted">No runs found. Start a run to begin.</p> : null}
          <div className="run-list">
            {runs.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`run-list-item${run?.id === item.id ? " is-selected" : ""}`}
                onClick={() => setRun(item)}
              >
                <span><strong>{item.project_code}</strong><small>Run #{item.id} · {item.current_stage}</small></span>
                <span className={`run-status run-status--${item.status}`}>{item.status}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel workflow-detail-panel">
          {run ? (
            <>
              <div className="workflow-run-heading">
                <div>
                  <h2>{run.project_code} · Run #{run.id}</h2>
                  <p>Started {new Date(run.created_at).toLocaleString()}</p>
                </div>
                <span className={`run-status run-status--${run.status}`}>{run.status}</span>
              </div>
              <div className="workflow-run-state">
                <span>Current Stage</span>
                <strong>{run.current_stage}</strong>
              </div>
              {run.status === "running" && canApprove(user?.role) ? (
                <>
                  <label>
                    Approval Note
                    <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
                  </label>
                  <div className="button-row">
                    <button onClick={() => void step(true)} disabled={working}>
                      {working ? "Saving…" : "Approve & Next"}
                    </button>
                    <button className="warn" onClick={() => void step(false)} disabled={working}>
                      Reject / Block
                    </button>
                  </div>
                </>
              ) : null}
              {run.status !== "running" ? <p className="muted">This run is {run.status} and cannot be advanced further.</p> : null}
              {run.status === "running" && !canApprove(user?.role) ? (
                <p className="muted">Your role can view this run but cannot approve workflow stages.</p>
              ) : null}
              <div className="workflow-log-list">
                <h3>Run History</h3>
                {logs.length ? logs.map((log, index) => (
                  <article className="workflow-log" key={`${log.created_at}-${index}`}>
                    <div><strong>{log.action}</strong><span>{log.agent_name} · {log.status}</span></div>
                    <p>{log.details || "No additional details."}</p>
                    <small>{new Date(log.created_at).toLocaleString()}</small>
                  </article>
                )) : <p className="muted">No history is recorded for this run yet.</p>}
              </div>
            </>
          ) : (
            <p className="muted">Select a workflow run to view its state and history.</p>
          )}
        </section>
      </div>
    </section>
  );
}
