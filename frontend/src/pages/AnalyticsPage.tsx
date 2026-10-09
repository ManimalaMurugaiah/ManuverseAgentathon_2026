import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import api from "../api/client";
import type { DashboardSummary } from "../types";

export function AnalyticsPage(): JSX.Element {
  const [summary, setSummary] = useState<DashboardSummary>({
    total_runs: 0,
    running: 0,
    blocked: 0,
    completed: 0,
  });

  useEffect(() => {
    const load = async () => {
      const { data } = await api.get<DashboardSummary>("/dashboard/summary");
      setSummary(data);
    };

    void load();
  }, []);

  const data = useMemo(
    () => [
      { name: "Running", value: summary.running },
      { name: "Blocked", value: summary.blocked },
      { name: "Completed", value: summary.completed },
    ],
    [summary],
  );

  return (
    <section>
      <h2>AI and Workflow Analytics</h2>
      <div className="chart-card">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#1d4ed8" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
