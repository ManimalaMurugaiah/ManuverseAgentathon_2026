import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import api from "../api/client";
import { getApiErrorMessage } from "../api/errors";
import { useApiData } from "../api/useApiData";
import { useBusiness } from "../api/useBusiness";
import { ErrorState, LoadingState, Notice } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import type { ProjectList, ReportData, ReportInterval, ReportSchedule, ReportTab, SavedReport } from "../types";
import { formatMoney, todayIso } from "../utils/format";
import { createReportPdf, csvCell, isoWeek } from "../utils/reportPdf";

type ReportFormat = "PDF" | "Excel";
type LibraryTab = "Standard reports" | "Saved reports" | "Scheduled reports" | "Custom reports";

const REPORT_TABS: ReportTab[] = ["Project Health", "Milestone Report", "Risk Report", "Action Report", "Dependency Report"];
const LIBRARY_TABS: LibraryTab[] = ["Standard reports", "Saved reports", "Scheduled reports", "Custom reports"];
const INTERVALS: ReportInterval[] = ["Day", "Week", "Month", "Year"];
const SCHEDULE_ROLES = ["admin", "manager"];

const formatShort = (value: string | null): string =>
  value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

function defaultValue(interval: ReportInterval): string {
  const today = todayIso();
  if (interval === "Day") return today;
  if (interval === "Week") return isoWeek(new Date());
  if (interval === "Month") return today.slice(0, 7);
  return today.slice(0, 4);
}

const validValue = (interval: ReportInterval, value: string): boolean =>
  interval !== "Year" || (/^\d{4}$/.test(value) && Number(value) >= 2000 && Number(value) <= 2100);

function TrendChart({ data, interval }: Readonly<{ data: ReportData; interval: ReportInterval }>): JSX.Element {
  const buckets = data.stats.trend;
  const max = Math.max(1, ...buckets.map((bucket) => bucket.total));
  return (
    <div className="report-chart" role="img" aria-label={`${interval} milestone status trend`}>
      {buckets.map((bucket) => (
        <div className="report-chart-column" key={bucket.label} title={`${bucket.total} milestones`}>
          <span className="chart-column-total">{bucket.total}</span>
          <div className="chart-stack" style={{ height: `${bucket.total ? Math.max(24, (bucket.total / max) * 142) : 4}px` }}>
            <span className="chart-segment chart-on-track" style={{ flex: bucket.on_track }} />
            <span className="chart-segment chart-at-risk" style={{ flex: bucket.at_risk }} />
            <span className="chart-segment chart-delayed" style={{ flex: bucket.delayed }} />
          </div>
          <small>{bucket.label}</small>
        </div>
      ))}
    </div>
  );
}

function exportTable(tab: ReportTab, data: ReportData): { headers: string[]; rows: string[][] } {
  if (tab === "Risk Report") {
    return {
      headers: ["Risk ID", "Risk", "Severity", "Status", "Project", "Owner", "Due date"],
      rows: data.risks.map((risk) => [`RSK-${risk.id}`, risk.title, risk.severity, risk.status, risk.project ?? "", risk.owner ?? "", risk.due_date ?? ""]),
    };
  }
  if (tab === "Action Report") {
    return {
      headers: ["Action ID", "Action", "Milestone", "Owner", "Priority", "Due date", "Status"],
      rows: data.actions.map((action) => [`ACT-${action.id}`, action.title, action.milestone ?? "", action.owner ?? "", action.priority, action.due_date ?? "", action.status]),
    };
  }
  if (tab === "Dependency Report") {
    return { headers: ["Dependency", "Owner", "Due date", "Status"], rows: data.dependencies.map((item) => [item.dependency, item.owner ?? "", item.due ?? "", item.status]) };
  }
  return { headers: ["Milestone", "Planned date", "Owner", "Status"], rows: data.milestones.map((item) => [item.milestone, item.planned ?? "", item.owner ?? "", item.status]) };
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReportsPage(): JSX.Element {
  const { user } = useAuth();
  const { business } = useBusiness();
  const [searchParams] = useSearchParams();
  const canSchedule = SCHEDULE_ROLES.includes(user?.role ?? "");

  const [project, setProject] = useState(searchParams.get("project_id") ?? "");
  const [tab, setTab] = useState<ReportTab>("Project Health");
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("Standard reports");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"ok" | "error">("ok");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [interval, setIntervalValue] = useState<ReportInterval>("Week");
  const [values, setValues] = useState<Record<ReportInterval, string>>({
    Day: defaultValue("Day"), Week: defaultValue("Week"), Month: defaultValue("Month"), Year: defaultValue("Year"),
  });
  const [format, setFormat] = useState<ReportFormat>("PDF");
  const [previewing, setPreviewing] = useState(false);

  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleFrequency, setScheduleFrequency] = useState<"Weekly" | "Monthly">("Weekly");

  const projects = useApiData<ProjectList>("/projects", { page_size: 100, business });
  const standard = useApiData<ReportData>("/reports/data", { interval: "Week", value: defaultValue("Week"), project_id: project, business });
  const saved = useApiData<SavedReport[]>("/reports/saved", { limit: 20 });
  const schedules = useApiData<ReportSchedule[]>("/reports/schedules");

  const value = values[interval];
  const previewReady = previewing && validValue(interval, value);
  const preview = useApiData<ReportData>(previewReady ? "/reports/data" : null, { interval, value, project_id: project, business });

  const projectName = project ? projects.data?.items.find((item) => String(item.id) === project)?.name ?? "Selected project" : business || "All projects";
  const tell = (text: string, tone: "ok" | "error" = "ok") => { setMessage(text); setMessageTone(tone); };

  const openDialog = (nextFormat?: ReportFormat, nextTab?: ReportTab) => {
    setMessage("");
    setPreviewing(false);
    if (nextFormat) setFormat(nextFormat);
    if (nextTab) setTab(nextTab);
    setDialogOpen(true);
  };

  const downloadReport = async () => {
    const data = preview.data;
    if (!data) return;
    const { headers, rows } = exportTable(tab, data);
    const slug = tab.toLowerCase().replace(/ /g, "-");
    const stamp = `${projectName.replace(/\W+/g, "-")}-${slug}-${value}`;
    try {
      if (format === "Excel") {
        const head = [`${tab} — ${projectName}`, `Reporting period: ${interval} (${data.stats.range_label})`, ""];
        const content = [...head.map(csvCell), headers.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\r\n");
        download(new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }), `${stamp}.csv`);
      } else {
        const pdf = createReportPdf({
          title: tab, project: projectName, interval: `${interval} (${data.stats.range_label})`,
          totals: { onTrack: data.stats.on_track, atRisk: data.stats.at_risk, delayed: data.stats.delayed, milestones: data.stats.milestones },
          buckets: data.stats.trend, headers, rows,
        });
        download(pdf, `${stamp}.pdf`);
      }
      tell(format === "Excel" ? "Excel-compatible CSV downloaded." : "PDF report downloaded.");
      setDialogOpen(false);
      try {
        await api.post("/reports/saved", {
          title: `${tab} · ${projectName} · ${data.stats.range_label}`, report_type: tab, project_id: project ? Number(project) : null, period: interval,
        });
        saved.reload();
      } catch {
        // The file already downloaded; failing to log it in history is not worth interrupting the user.
      }
    } catch (error) {
      tell(error instanceof Error ? `Unable to download report: ${error.message}` : "Unable to download report.", "error");
    }
  };

  const saveSchedule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await api.post("/reports/schedules", { name: scheduleName.trim(), report_type: tab, frequency: scheduleFrequency, format: "PDF" });
      setShowScheduleForm(false);
      setScheduleName("");
      tell(`${scheduleFrequency} report schedule saved.`);
      schedules.reload();
    } catch (error) {
      tell(getApiErrorMessage(error, "Could not save this schedule."), "error");
    }
  };

  const toggleSchedule = async (schedule: ReportSchedule) => {
    try {
      await api.patch(`/reports/schedules/${schedule.id}`, { is_active: !schedule.is_active });
      schedules.reload();
    } catch (error) {
      tell(getApiErrorMessage(error, "Could not update this schedule."), "error");
    }
  };

  const removeSchedule = async (schedule: ReportSchedule) => {
    try {
      await api.delete(`/reports/schedules/${schedule.id}`);
      schedules.reload();
    } catch (error) {
      tell(getApiErrorMessage(error, "Could not delete this schedule."), "error");
    }
  };

  const data = standard.data;
  const trendPaths = useMemo(() => {
    const trend = data?.milestone_trend;
    if (!trend || trend.labels.length < 2) return null;
    const max = Math.max(1, ...trend.planned, ...trend.actual);
    const point = (series: number[]) => series.map((count, index) => `${25 + (index * 255) / (series.length - 1)},${135 - (count / max) * 120}`);
    return { planned: point(trend.planned), actual: point(trend.actual), labels: trend.labels };
  }, [data]);

  const budgetPct = data?.budget.pct ?? 0;
  const recent = saved.data ?? [];

  return (
    <section className="feature-page reports-page screenshot-reports-page">
      <header className="feature-heading">
        <div><h1>Reports &amp; analytics</h1><p>Generate insights and track performance · {projectName}</p></div>
        <div className="report-heading-actions">
          <label className="visually-hidden" htmlFor="report-project">Project</label>
          <select id="report-project" aria-label="Project" className="report-project-select" value={project} onChange={(event) => setProject(event.target.value)}>
            <option value="">{business || "All projects"}</option>
            {(projects.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <div className="report-export-menu-wrap">
            <button type="button" className="secondary-button" aria-expanded={exportMenuOpen} onClick={() => setExportMenuOpen((open) => !open)}>Export⌄</button>
            {exportMenuOpen ? (
              <div className="report-export-menu" role="menu" aria-label="Export format">
                <button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); openDialog("PDF"); }}>Export as PDF</button>
                <button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); openDialog("Excel"); }}>Export as Excel</button>
              </div>
            ) : null}
          </div>
          <button type="button" className="primary-button report-generate-button" aria-label="Generate report" onClick={() => openDialog()}>＋ Generate report</button>
        </div>
      </header>
      <Notice message={dialogOpen && messageTone === "error" ? "" : message} tone={messageTone} />

      <nav className="report-library-tabs" role="tablist" aria-label="Report library">
        {LIBRARY_TABS.map((item) => <button key={item} type="button" role="tab" aria-selected={libraryTab === item} className={libraryTab === item ? "is-selected" : ""} onClick={() => setLibraryTab(item)}>{item}</button>)}
      </nav>

      {libraryTab === "Standard reports" ? (
        <>
          {standard.error ? <ErrorState message={standard.error} onRetry={standard.reload} /> : null}
          {standard.loading && !data ? <LoadingState label="Loading report data…" /> : null}
          <div className="standard-report-grid">
            <section className="feature-card standard-report-card">
              <h2>Project performance</h2>
              <div className="performance-chart" role="img" aria-label={`Project performance across ${data?.performance.length ?? 0} projects`}>
                {(data?.performance ?? []).map((item) => (
                  <span key={item.id} className={item.schedule_status === "Delayed" ? "performance-bar--red" : item.schedule_status === "At risk" ? "performance-bar--amber" : ""} style={{ height: `${Math.max(item.progress, 3)}%` }} title={`${item.name}: ${item.progress}%`} />
                ))}
              </div>
              <div className="performance-labels">{(data?.performance ?? []).map((item) => <span key={item.id} title={item.name}>{item.code ?? `#${item.id}`}</span>)}</div>
              <p className="chart-footnote">{data && !data.performance.length ? "No projects to show yet." : "Milestone completion across the most recent projects"}</p>
            </section>
            <section className="feature-card standard-report-card">
              <h2>Budget utilization</h2>
              <div className="budget-chart-wrap">
                <div className="budget-donut" role="img" aria-label={`${budgetPct} percent of project budget spent`} style={{ background: `conic-gradient(#0d9d82 0 ${budgetPct}%, #e9eef6 ${budgetPct}% 100%)` }}><strong>{budgetPct}%</strong></div>
                <div className="budget-labels"><span>Spent<strong>{formatMoney(data?.budget.spent)}</strong></span><span>Of budget<strong>{formatMoney(data?.budget.total)}</strong></span></div>
              </div>
            </section>
            <section className="feature-card standard-report-card">
              <div className="feature-card-heading"><h2>Milestone trend</h2><span className="milestone-trend-legend"><i />Planned <b />Actual</span></div>
              {trendPaths ? (
                <>
                  <svg className="milestone-trend-chart" viewBox="0 0 300 160" role="img" aria-label="Planned and actual milestone trend">
                    <path d="M25 135 H290 M25 95 H290 M25 55 H290 M25 15 H290" className="chart-grid-line" />
                    <polyline points={trendPaths.planned.join(" ")} className="trend-planned-line" />
                    <polyline points={trendPaths.actual.join(" ")} className="trend-actual-line" />
                    {trendPaths.actual.map((pair) => { const [x, y] = pair.split(","); return <circle key={x} cx={x} cy={y} r="3.5" className="trend-actual-point" />; })}
                  </svg>
                  <div className="trend-axis-labels">{[0, 2, 3, 5].map((index) => <span key={index}>{trendPaths.labels[index]}</span>)}</div>
                </>
              ) : <p className="chart-footnote">Add milestones with due dates to see the planned versus actual trend.</p>}
            </section>
          </div>
          <section className="feature-card recent-reports-card">
            <div className="feature-card-heading"><h2>Recent reports</h2><span className="record-count">{recent.length} reports</span></div>
            <div className="responsive-table-wrap">
              <table className="feature-table recent-reports-table">
                <thead><tr><th>Report</th><th>Type</th><th>Created by</th><th>Date</th><th>Status</th><th>Open</th></tr></thead>
                <tbody>
                  {recent.map((report) => (
                    <tr key={report.id}>
                      <td><strong>{report.title}</strong></td><td>{report.report_type}</td><td>{report.created_by}</td><td>{formatShort(report.created_at)}</td>
                      <td><span className="status-pill status-completed">Completed</span></td>
                      <td><button type="button" className="table-action-button" onClick={() => openDialog(undefined, report.report_type as ReportTab)}>Open</button></td>
                    </tr>
                  ))}
                  {saved.data && !recent.length ? <tr><td colSpan={6} className="table-empty">No reports yet. Generate a report to see it here.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {libraryTab === "Saved reports" ? (
        <section className="feature-card report-library-panel">
          <div className="feature-card-heading"><div><h2>Saved reports</h2><p>Open a report to review or export its latest data.</p></div></div>
          <div className="report-highlight-list">
            {recent.map((report) => (
              <article className="report-highlight" key={report.id}>
                <span className="highlight-rank">▤</span>
                <span className="highlight-copy"><strong>{report.title}</strong><small>{report.report_type} · saved {formatShort(report.created_at)}</small></span>
                <button type="button" className="table-action-button" onClick={() => openDialog(undefined, report.report_type as ReportTab)}>Open report</button>
              </article>
            ))}
            {saved.data && !recent.length ? <p className="pl-muted">Nothing saved yet. Reports are saved automatically when you download them.</p> : null}
          </div>
        </section>
      ) : null}

      {libraryTab === "Scheduled reports" ? (
        <section className="feature-card report-library-panel">
          <div className="feature-card-heading">
            <div><h2>Scheduled reports</h2><p>Manage recurring report delivery.</p></div>
            {canSchedule ? <button type="button" className="secondary-button" onClick={() => setShowScheduleForm((show) => !show)}>＋ Add schedule</button> : null}
          </div>
          {showScheduleForm ? (
            <form className="schedule-form" onSubmit={(event) => void saveSchedule(event)}>
              <label>Report name<input required minLength={2} maxLength={80} value={scheduleName} onChange={(event) => setScheduleName(event.target.value)} placeholder="e.g. Monthly project health" /></label>
              <label>Frequency<select value={scheduleFrequency} onChange={(event) => setScheduleFrequency(event.target.value as "Weekly" | "Monthly")}><option>Weekly</option><option>Monthly</option></select></label>
              <button type="submit" className="primary-button">Save schedule</button>
            </form>
          ) : null}
          {(schedules.data ?? []).map((schedule) => (
            <article className="scheduled-report-row" key={schedule.id}>
              <span><strong>{schedule.name}</strong><small>{schedule.frequency} · {schedule.report_type} · {schedule.format}</small></span>
              <span className={`status-pill ${schedule.is_active ? "status-completed" : "status-monitoring"}`}>{schedule.is_active ? "Active" : "Paused"}</span>
              {canSchedule ? (
                <>
                  <button type="button" className="table-action-button" onClick={() => void toggleSchedule(schedule)}>{schedule.is_active ? "Pause" : "Resume"}</button>
                  <button type="button" className="table-action-button" aria-label={`Delete ${schedule.name}`} onClick={() => void removeSchedule(schedule)}>Delete</button>
                </>
              ) : null}
            </article>
          ))}
          {schedules.data && !schedules.data.length ? <p className="pl-muted">No schedules yet.</p> : null}
          <p className="pl-muted">Schedules are stored for planning. Automatic email delivery is not connected yet.</p>
        </section>
      ) : null}

      {libraryTab === "Custom reports" ? (
        <section className="feature-card report-library-panel custom-report-panel">
          <div className="feature-card-heading"><div><h2>Custom reports</h2><p>Choose a report subject and reporting period before generating a tailored export.</p></div></div>
          <div className="custom-report-fields">
            <label>Report subject<select value={tab} onChange={(event) => setTab(event.target.value as ReportTab)}>{REPORT_TABS.map((item) => <option key={item}>{item}</option>)}</select></label>
            <button type="button" className="primary-button" onClick={() => openDialog()}>Generate custom report</button>
          </div>
        </section>
      ) : null}

      {dialogOpen ? (
        <div className="modal-backdrop report-modal-backdrop">
          <section className="feature-modal report-modal" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title">
            <div className="modal-heading">
              <div><span className="eyebrow">REPORT DOWNLOAD</span><h2 id="report-dialog-title">Choose report options</h2></div>
              <button type="button" className="modal-close" aria-label="Close report options" onClick={() => setDialogOpen(false)}>×</button>
            </div>
            <div className="feature-form">
              <label className="report-dialog-field">Report
                <select value={tab} onChange={(event) => { setTab(event.target.value as ReportTab); setPreviewing(false); }}>{REPORT_TABS.map((item) => <option key={item}>{item}</option>)}</select>
              </label>
              <label className="report-dialog-field">Reporting interval
                <select value={interval} onChange={(event) => { setIntervalValue(event.target.value as ReportInterval); setPreviewing(false); }}>{INTERVALS.map((item) => <option key={item}>{item}</option>)}</select>
              </label>
              <label className="report-dialog-field">{interval === "Day" ? "Select date" : `Select ${interval.toLowerCase()}`}
                <input
                  aria-label={interval === "Day" ? "Select date" : `Select ${interval.toLowerCase()}`}
                  type={interval === "Day" ? "date" : interval === "Week" ? "week" : interval === "Month" ? "month" : "number"}
                  min={interval === "Year" ? "2000" : undefined}
                  max={interval === "Year" ? "2100" : undefined}
                  value={value}
                  required
                  onChange={(event) => { setValues({ ...values, [interval]: event.target.value }); setPreviewing(false); }}
                />
              </label>
              <label className="report-dialog-field">Format
                <select value={format} onChange={(event) => setFormat(event.target.value as ReportFormat)}>
                  <option value="PDF">PDF</option>
                  <option value="Excel">Excel-compatible CSV</option>
                </select>
              </label>
              {previewing && preview.loading && !preview.data ? <LoadingState label="Preparing preview…" /> : null}
              {previewing && preview.error ? <p className="error" role="alert">{preview.error}</p> : null}
              {previewing && preview.data ? (
                <div className="report-preview">
                  <div className="feature-card-heading"><div><h3>Report preview</h3><p>{projectName} · {tab} · {preview.data.stats.range_label}</p></div></div>
                  <div className="chart-legend"><span><i className="chart-on-track" />On track</span><span><i className="chart-at-risk" />At risk</span><span><i className="chart-delayed" />Delayed</span></div>
                  <TrendChart data={preview.data} interval={interval} />
                  <p className="pl-muted">{exportTable(tab, preview.data).rows.length} row(s) will be included.</p>
                </div>
              ) : null}
              {messageTone === "error" && message ? <p className="error" role="alert">{message}</p> : null}
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setDialogOpen(false)}>Cancel</button>
                <button type="button" className="secondary-button" disabled={!validValue(interval, value) || !value} onClick={() => setPreviewing(true)}>Preview</button>
                {previewing && preview.data ? <button type="button" className="primary-button" onClick={() => void downloadReport()}>Download Report</button> : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
