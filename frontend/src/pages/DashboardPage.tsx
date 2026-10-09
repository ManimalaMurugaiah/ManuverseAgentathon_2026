import { useEffect, useState } from "react";

import api from "../api/client";
import type { DashboardSummary } from "../types";

const milestones = [
  "Design Freeze",
  "Drawing Approval",
  "PO Release",
  "Vendor Manufacturing",
  "FAT",
  "Shipment",
  "Site Readiness",
  "Equipment Delivery",
  "Installation",
  "Mechanical Completion",
  "SAT",
  "Commissioning",
  "Production Handover",
];

export function DashboardPage(): JSX.Element {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await api.get<DashboardSummary>("/dashboard/summary");
      setSummary(data);
    };

    void load();
  }, []);

  return (
    <section>
      <h2>Project Dashboard</h2>
      <div className="cards">
        <article className="card">
          <h3>Total Runs</h3>
          <p>{summary?.total_runs ?? 0}</p>
        </article>
        <article className="card">
          <h3>Running</h3>
          <p>{summary?.running ?? 0}</p>
        </article>
        <article className="card">
          <h3>Blocked</h3>
          <p>{summary?.blocked ?? 0}</p>
        </article>
        <article className="card">
          <h3>Completed</h3>
          <p>{summary?.completed ?? 0}</p>
        </article>
      </div>

      <h3>Milestone Flow</h3>
      <ol className="milestones">
        {milestones.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </section>
  );
}
