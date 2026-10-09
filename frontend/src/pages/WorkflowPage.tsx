import { useState } from "react";

import api from "../api/client";
import type { WorkflowRun } from "../types";

export function WorkflowPage(): JSX.Element {
  const [projectCode, setProjectCode] = useState("PRJ-001");
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [note, setNote] = useState("");

  const startRun = async () => {
    const { data } = await api.post<WorkflowRun>("/workflow/runs", { project_code: projectCode });
    setRun(data);
  };

  const step = async (approved: boolean) => {
    if (!run) return;
    const { data } = await api.post<WorkflowRun>("/workflow/step", {
      run_id: run.id,
      approved,
      note,
    });
    setRun(data);
    setNote("");
  };

  return (
    <section>
      <h2>Workflow Control</h2>
      <div className="panel">
        <label>
          Project Code
          <input value={projectCode} onChange={(e) => setProjectCode(e.target.value)} />
        </label>
        <button onClick={startRun}>Start Run</button>
      </div>

      {run ? (
        <div className="panel">
          <h3>Run #{run.id}</h3>
          <p>Current Stage: {run.current_stage}</p>
          <p>Status: {run.status}</p>
          <label>
            Approval Note
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="button-row">
            <button onClick={() => step(true)}>Approve & Next</button>
            <button className="warn" onClick={() => step(false)}>
              Reject / Block
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
