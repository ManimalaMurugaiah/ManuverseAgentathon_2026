import { useEffect, useState } from "react";
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

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

  const total = summary?.total_runs ?? 24;
  const onTrack = summary?.running ?? 17;
  const atRisk = summary?.blocked ?? 4;
  const delayed = summary ? Math.max(summary.total_runs - summary.running - summary.blocked - summary.completed, 0) : 3;

  const pieData = [
    { name: "On Track", value: onTrack, color: "#11a36b" },
    { name: "At Risk", value: atRisk, color: "#f59e0b" },
    { name: "Delayed", value: delayed, color: "#ef4444" },
  ];

  const trend = [
    { day: "01 Oct", pct: 87 },
    { day: "03 Oct", pct: 84 },
    { day: "05 Oct", pct: 78 },
    { day: "07 Oct", pct: 75 },
    { day: "09 Oct", pct: 71 },
    { day: "11 Oct", pct: 63 },
    { day: "13 Oct", pct: 55 },
    { day: "15 Oct", pct: 49 },
  ];

  return (
    <section className="dashboard-grid">
      <div className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <h2>Project Overview</h2>
            <p className="muted">Real-time project health, risks and AI-driven insights</p>
          </div>
          <p className="updated">Last updated: 08 Oct 2026, 10:24 AM</p>
        </header>

        <div className="kpi-cards">
          <article className="kpi-card">
            <p>Total Milestones</p>
            <strong>{total}</strong>
          </article>
          <article className="kpi-card">
            <p>On Track</p>
            <strong>{onTrack}</strong>
          </article>
          <article className="kpi-card kpi-warning">
            <p>At Risk</p>
            <strong>{atRisk}</strong>
          </article>
          <article className="kpi-card kpi-danger">
            <p>Delayed</p>
            <strong>{delayed}</strong>
          </article>
          <article className="kpi-card">
            <p>Project Health</p>
            <strong className="danger-text">AT RISK</strong>
          </article>
        </div>

        <div className="dashboard-two-col">
          <section className="surface">
            <h3>Project Timeline</h3>
            <ol className="timeline-row">
              {milestones.slice(0, 5).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </section>

          <section className="surface">
            <h3>Milestone Status</h3>
            <div className="pie-wrap">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={76}>
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <section className="surface">
          <h3>Key Dependency Chain and Bottlenecks</h3>
          <div className="dependency-chain">
            <span className="chip chip-danger">Engineering Approval (Delayed)</span>
            <span className="chain-arrow">&gt;</span>
            <span className="chip chip-warn">PO Release (At Risk)</span>
            <span className="chain-arrow">&gt;</span>
            <span className="chip chip-warn">Material Delivery (At Risk)</span>
            <span className="chain-arrow">&gt;</span>
            <span className="chip">Installation (Not Started)</span>
          </div>

          <p className="alert-strip">Delay in Engineering Approval is impacting 4 downstream activities.</p>

          <table className="data-table">
            <thead>
              <tr>
                <th>Bottleneck</th>
                <th>Root Cause</th>
                <th>Owner</th>
                <th>Predicted Delay</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Engineering Approval</td>
                <td>Approval pending from engineering team</td>
                <td>Ravi</td>
                <td>7 days</td>
                <td><span className="badge danger">Delayed</span></td>
              </tr>
              <tr>
                <td>Vendor Confirmation</td>
                <td>Vendor delivery delay (8 days)</td>
                <td>Vendor A</td>
                <td>5 days</td>
                <td><span className="badge warn">At Risk</span></td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="surface">
          <h3>Project Health Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend}>
              <Line type="monotone" dataKey="pct" stroke="#2563eb" strokeWidth={3} dot={false} />
              <Tooltip />
            </LineChart>
          </ResponsiveContainer>
        </section>
      </div>

      <aside className="dashboard-rail">
        <section className="rail-card">
          <h3>AI Insights</h3>
          <p className="critical">Critical Bottleneck: Engineering Approval Delayed</p>
          <p>Predicted project delay: 7 days</p>
          <div className="button-row">
            <button>Assign Action</button>
            <button className="ghost">Escalate</button>
          </div>
        </section>

        <section className="rail-card">
          <h3>Upcoming Risks</h3>
          <ul className="risk-list">
            <li>Material delivery delay (Vendor A) - At Risk</li>
            <li>Installation resource unavailability - At Risk</li>
            <li>Commissioning test readiness - On Track</li>
          </ul>
        </section>

        <section className="rail-card">
          <h3>Last Action Update</h3>
          <p>PO release action assigned to Kumar. Due date: 12 Oct 2026.</p>
        </section>
      </aside>
    </section>
  );
}
