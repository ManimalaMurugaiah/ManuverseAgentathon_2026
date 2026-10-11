import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { sampleActions, sampleBusinesses, sampleRisks } from "./sampleData";

type ReportTab = "Project Health" | "Milestone Report" | "Risk Report" | "Action Report" | "Dependency Report";
type ReportPeriod = "Daily" | "Weekly" | "Monthly" | "Yearly";
type ReportInterval = "Day" | "Week" | "Month" | "Year";
type ReportFormat = "PDF" | "Excel";
type ReportLibraryTab = "Standard reports" | "Saved reports" | "Scheduled reports" | "Custom reports";

const reportTabs: ReportTab[] = ["Project Health", "Milestone Report", "Risk Report", "Action Report", "Dependency Report"];
const reportLibraryTabs: ReportLibraryTab[] = ["Standard reports", "Saved reports", "Scheduled reports", "Custom reports"];
const recentReports = [
  { title: "Project health overview", type: "Project Health" as ReportTab, createdBy: "Ravi K.", date: "15 Oct 2026" },
  { title: "Risk and issue analysis", type: "Risk Report" as ReportTab, createdBy: "Anita S.", date: "14 Oct 2026" },
  { title: "Agent performance", type: "Action Report" as ReportTab, createdBy: "Priya S.", date: "13 Oct 2026" },
];
const reportProjects = ["PRJ-001", "PRJ-002"];
const milestoneRows = [
  { milestone: "Engineering Approval", planned: "10 Oct 2026", owner: "Ravi", status: "At Risk" },
  { milestone: "PO Release", planned: "12 Oct 2026", owner: "Kumar", status: "On Track" },
  { milestone: "Material Delivery", planned: "20 Oct 2026", owner: "Vendor A", status: "At Risk" },
  { milestone: "Installation", planned: "25 Oct 2026", owner: "Site Team", status: "Delayed" },
  { milestone: "Commissioning", planned: "30 Oct 2026", owner: "Commissioning Team", status: "Not Started" },
];
const dependencyRows = [
  { dependency: "Approved drawings → purchase order", owner: "Engineering", due: "10 Oct 2026", status: "At Risk" },
  { dependency: "Purchase order → vendor manufacturing", owner: "Procurement", due: "12 Oct 2026", status: "On Track" },
  { dependency: "Material delivery → installation", owner: "Site Team", due: "20 Oct 2026", status: "At Risk" },
];
const periodDetails: Record<ReportPeriod, { range: string; onTrack: number; atRisk: number; delayed: number; milestones: number; trend: number[] }> = {
  Daily: { range: "Today, 09 Oct 2026", onTrack: 4, atRisk: 2, delayed: 1, milestones: 7, trend: [3, 4, 3, 5, 4, 6, 5] },
  Weekly: { range: "05 Oct – 11 Oct 2026", onTrack: 17, atRisk: 4, delayed: 3, milestones: 24, trend: [12, 14, 13, 17, 16, 18, 17] },
  Monthly: { range: "01 Oct – 31 Oct 2026", onTrack: 68, atRisk: 11, delayed: 7, milestones: 86, trend: [48, 53, 50, 60, 64, 68, 68] },
  Yearly: { range: "01 Jan – 31 Dec 2026", onTrack: 214, atRisk: 32, delayed: 18, milestones: 264, trend: [132, 148, 157, 169, 184, 203, 214] },
};

const intervalPeriods: Record<ReportInterval, ReportPeriod> = {
  Day: "Daily",
  Week: "Weekly",
  Month: "Monthly",
  Year: "Yearly",
};

const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

function escapePdfText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/[\\()]/g, "\\$&");
}

function createReportPdf(
  title: string,
  project: string,
  interval: string,
  stats: (typeof periodDetails)[ReportPeriod],
  headers: string[],
  rows: string[][],
): Blob {
  const pageWidth = 612;
  const pageHeight = 792;
  const pages: string[][] = [[]];
  let currentPage = pages[0];
  let currentY = 752;
  const addText = (text: string, size = 10, color = "0.16 0.23 0.34") => {
    currentPage.push(`${color} rg BT /F1 ${size} Tf 1 0 0 1 50 ${currentY} Tm (${escapePdfText(text)}) Tj ET`);
    currentY -= size + 6;
  };
  const addWrappedText = (text: string) => {
    const words = text.split(/\s+/);
    let line = "";
    for (const word of words) {
      if (line && `${line} ${word}`.length > 88) {
        addText(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) addText(line);
  };

  addText(title, 20, "0.10 0.20 0.36");
  currentY = 718;
  addText(`Project: ${project}    Reporting period: ${interval}`, 10);
  currentY = 674;
  addText("Milestone summary", 13, "0.10 0.20 0.36");
  currentY = 650;
  addText(`On track: ${stats.onTrack}       At risk: ${stats.atRisk}       Delayed: ${stats.delayed}       Total: ${stats.milestones}`);
  currentY = 616;
  addText("Milestone status trend", 12, "0.10 0.20 0.36");

  const chartLeft = 72;
  const chartBottom = 516;
  const chartMaxHeight = 70;
  const chartMaxValue = Math.max(...stats.trend);
  const statusTotal = stats.onTrack + stats.atRisk + stats.delayed;
  currentPage.push(`0.88 0.91 0.95 RG 1 w ${chartLeft - 8} ${chartBottom} m 545 ${chartBottom} l S`);
  stats.trend.forEach((value, index) => {
    const x = chartLeft + index * 68;
    const barHeight = Math.max(8, value / chartMaxValue * chartMaxHeight);
    const onTrackHeight = barHeight * stats.onTrack / statusTotal;
    const atRiskHeight = barHeight * stats.atRisk / statusTotal;
    const delayedHeight = barHeight - onTrackHeight - atRiskHeight;
    currentPage.push(
      `0.13 0.68 0.48 rg ${x} ${chartBottom} 26 ${onTrackHeight.toFixed(2)} re f`,
      `0.95 0.68 0.22 rg ${x} ${(chartBottom + onTrackHeight).toFixed(2)} 26 ${atRiskHeight.toFixed(2)} re f`,
      `0.91 0.32 0.35 rg ${x} ${(chartBottom + onTrackHeight + atRiskHeight).toFixed(2)} 26 ${delayedHeight.toFixed(2)} re f`,
    );
    const label = interval === "Daily" ? `${8 + index}:00` : interval === "Yearly" ? `Q${index + 1}` : `${index + 1}`;
    currentPage.push(`0.35 0.42 0.53 rg BT /F1 8 Tf 1 0 0 1 ${x - 2} ${chartBottom - 14} Tm (${label}) Tj ET`);
    currentPage.push(`0.25 0.33 0.45 rg BT /F1 8 Tf 1 0 0 1 ${x + 6} ${chartBottom + barHeight + 5} Tm (${value}) Tj ET`);
  });

  currentY = 476;
  addText("Report details", 13, "0.10 0.20 0.36");
  addWrappedText(headers.join(" | "));
  currentY -= 4;
  for (const row of rows) {
    const wrappedRow = row.join(" | ");
    const lineCount = Math.max(1, Math.ceil(wrappedRow.length / 88));
    if (currentY - lineCount * 16 < 48) {
      pages.push([]);
      currentPage = pages[pages.length - 1];
      currentY = 744;
      addText(`${title} - continued`, 14, "0.10 0.20 0.36");
      addText(`Project: ${project}    Reporting period: ${interval}`, 9);
      currentY -= 5;
    }
    addWrappedText(wrappedRow);
    currentY -= 2;
  }

  const totalPages = pages.length;
  pages.forEach((commands, index) => {
    commands.push(`0.45 0.52 0.62 rg BT /F1 8 Tf 1 0 0 1 500 28 Tm (Page ${index + 1} of ${totalPages}) Tj ET`);
  });

  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(" ")}] /Count ${totalPages} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  pages.forEach((commands, index) => {
    const pageId = 4 + index * 2;
    const contentId = pageId + 1;
    const content = commands.join("\n");
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
  });

  let document = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(document.length);
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const crossReferenceOffset = document.length;
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    document += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${crossReferenceOffset}\n%%EOF`;
  return new Blob([document], { type: "application/pdf" });
}

function getReportRange(interval: ReportInterval, value: string): string {
  if (interval === "Day") {
    return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  if (interval === "Month") {
    return new Date(`${value}-01T00:00:00`).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }
  if (interval === "Year") return value;

  const [year, week] = value.split("-W").map(Number);
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(januaryFourth);
  const daysSinceMonday = (januaryFourth.getUTCDay() + 6) % 7;
  monday.setUTCDate(januaryFourth.getUTCDate() - daysSinceMonday + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const format = (date: Date) => date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${format(monday)} – ${format(sunday)}, ${year}`;
}

function ReportTrendChart({ period, stats }: { period: ReportPeriod; stats: (typeof periodDetails)[ReportPeriod] }): JSX.Element {
  const maxValue = Math.max(...stats.trend);
  return (
    <div className="report-chart" role="img" aria-label={`${period} milestone status trend`}>
      {stats.trend.map((value, index) => (
        <div className="report-chart-column" key={`${period}-${index}`} title={`${value} milestones`}>
          <span className="chart-column-total">{value}</span>
          <div className="chart-stack" style={{ height: `${Math.max(24, value / maxValue * 142)}px` }}>
            <span className="chart-segment chart-on-track" style={{ flex: stats.onTrack }} />
            <span className="chart-segment chart-at-risk" style={{ flex: stats.atRisk }} />
            <span className="chart-segment chart-delayed" style={{ flex: stats.delayed }} />
          </div>
          <small>{period === "Daily" ? `${8 + index}:00` : period === "Yearly" ? `Q${index + 1}` : `${index + 1}`}</small>
        </div>
      ))}
    </div>
  );
}

export function ReportsPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const globalProject = searchParams.get("project_code") ?? "";
  const selectedBusiness = searchParams.get("business") ?? "";
  const [project, setProject] = useState(globalProject || reportProjects[0]);
  const [period, setPeriod] = useState<ReportPeriod>("Weekly");
  const [tab, setTab] = useState<ReportTab>("Project Health");
  const [libraryTab, setLibraryTab] = useState<ReportLibraryTab>("Standard reports");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [scheduled, setScheduled] = useState(true);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleFrequency, setScheduleFrequency] = useState("Weekly");
  const [scheduledReportName, setScheduledReportName] = useState("Weekly project health summary");
  const [exportMessage, setExportMessage] = useState("");
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportInterval, setReportInterval] = useState<ReportInterval>("Week");
  const [reportDay, setReportDay] = useState("2026-10-09");
  const [reportWeek, setReportWeek] = useState("2026-W41");
  const [reportMonth, setReportMonth] = useState("2026-10");
  const [reportYear, setReportYear] = useState("2026");
  const [reportFormat, setReportFormat] = useState<ReportFormat>("PDF");
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [rangeOverride, setRangeOverride] = useState<string | null>(null);
  const stats = periodDetails[period];
  const reportValue = reportInterval === "Day"
    ? reportDay
    : reportInterval === "Week"
      ? reportWeek
      : reportInterval === "Month"
        ? reportMonth
        : reportYear;
  const reportPeriod = intervalPeriods[reportInterval];
  const reportRange = getReportRange(reportInterval, reportValue);
  const canPreviewReport = reportValue.length > 0 && (
    reportInterval !== "Year" || (/^\d{4}$/.test(reportValue) && Number(reportValue) >= 2000 && Number(reportValue) <= 2100)
  );
  const displayRange = rangeOverride ?? stats.range;
  const projectRisks = useMemo(
    () => sampleRisks.filter((risk) => risk.business === (
      selectedBusiness || (project === "PRJ-001" ? sampleBusinesses[0] : sampleBusinesses[4])
    )),
    [project, selectedBusiness],
  );
  const projectActions = sampleActions.filter((action) =>
    selectedBusiness ? action.business === selectedBusiness : action.project === project,
  );

  useEffect(() => {
    if (globalProject && reportProjects.includes(globalProject)) setProject(globalProject);
  }, [globalProject]);

  const getExportData = (): { headers: string[]; rows: string[][] } => {
    let headers: string[];
    let rows: string[][];
    if (tab === "Risk Report") {
      headers = ["Risk ID", "Risk", "Severity", "Status", "Production line", "Process", "Occurred at", "Owner"];
      rows = projectRisks.map((risk) => [risk.id, risk.title, risk.severity, risk.status, risk.line, risk.process, new Date(risk.occurredAt).toLocaleString(), risk.owner]);
    } else if (tab === "Action Report") {
      headers = ["Action ID", "Action", "Milestone", "Owner", "Priority", "Due date", "Status"];
      rows = projectActions.map((action) => [action.id, action.title, action.milestone, action.owner, action.priority, action.dueDate, action.status]);
    } else if (tab === "Dependency Report") {
      headers = ["Dependency", "Owner", "Due date", "Status"];
      rows = dependencyRows.map((item) => [item.dependency, item.owner, item.due, item.status]);
    } else {
      headers = ["Milestone", "Planned date", "Owner", "Status"];
      rows = milestoneRows.map((item) => [item.milestone, item.planned, item.owner, item.status]);
    }
    return { headers, rows };
  };

  const downloadBlob = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadExcel = (): void => {
    const { headers, rows } = getExportData();
    const summary = [`${tab} — ${project}`, `Reporting period: ${reportInterval} (${reportRange})`, ""];
    const content = [...summary.map(csvCell), headers.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `${project}-${tab.toLowerCase().replace(/ /g, "-")}-${reportValue}.csv`);
    setExportMessage("Excel-compatible CSV downloaded.");
  };

  const applyReportSelection = () => {
    setPeriod(reportPeriod);
    setRangeOverride(reportRange);
  };

  const downloadReport = (): void => {
    applyReportSelection();
    try {
      if (reportFormat === "Excel") {
        downloadExcel();
      } else {
        const { headers, rows } = getExportData();
        const pdf = createReportPdf(tab, project, `${reportInterval} (${reportRange})`, periodDetails[reportPeriod], headers, rows);
        downloadBlob(pdf, `${project}-${tab.toLowerCase().replace(/ /g, "-")}-${reportValue}.pdf`);
        setExportMessage("PDF report downloaded.");
      }
      setIsReportDialogOpen(false);
    } catch (error) {
      setExportMessage(error instanceof Error ? `Unable to download report: ${error.message}` : "Unable to download report.");
    }
  };

  const openReportDialog = (format?: ReportFormat): void => {
    setExportMessage("");
    setIsPreviewVisible(false);
    if (format) setReportFormat(format);
    setIsReportDialogOpen(true);
  };

  const openSavedReport = (reportType: ReportTab): void => {
    setTab(reportType);
    openReportDialog();
  };

  const saveSchedule = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setScheduledReportName(scheduleName.trim());
    setScheduled(true);
    setShowScheduleForm(false);
    setScheduleName("");
    setExportMessage(`${scheduleFrequency} report schedule saved.`);
  };

  return (
    <section className="feature-page reports-page screenshot-reports-page">
      <header className="feature-heading">
        <div><h1>Reports &amp; analytics</h1><p>Generate insights and track performance · {project}</p></div>
        <div className="report-heading-actions">
          <div className="report-export-menu-wrap">
            <button type="button" className="secondary-button" aria-expanded={exportMenuOpen} onClick={() => setExportMenuOpen((open) => !open)}>Export⌄</button>
            {exportMenuOpen ? <div className="report-export-menu" role="menu" aria-label="Export format"><button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); openReportDialog("PDF"); }}>Export as PDF</button><button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); openReportDialog("Excel"); }}>Export as Excel</button></div> : null}
          </div>
          <button type="button" className="primary-button report-generate-button" aria-label="Generate report" onClick={() => openReportDialog()}>＋ Generate report</button>
        </div>
      </header>
      {exportMessage ? <p className="export-feedback" role="status">{exportMessage}</p> : null}

      <nav className="report-library-tabs" role="tablist" aria-label="Report library">
        {reportLibraryTabs.map((item) => <button key={item} type="button" role="tab" aria-selected={libraryTab === item} className={libraryTab === item ? "is-selected" : ""} onClick={() => setLibraryTab(item)}>{item}</button>)}
      </nav>

      {libraryTab === "Standard reports" ? (
        <>
          <div className="standard-report-grid">
            <section className="feature-card standard-report-card"><h2>Project performance</h2><div className="performance-chart" role="img" aria-label="Project performance across five projects"><span style={{ height: "76%" }} title="Project 1: 76%" /><span className="performance-bar--amber" style={{ height: "49%" }} title="Project 2: 49%" /><span className="performance-bar--red" style={{ height: "24%" }} title="Project 3: 24%" /><span style={{ height: "61%" }} title="Project 4: 61%" /><span style={{ height: "34%" }} title="Project 5: 34%" /></div><div className="performance-labels"><span>P1</span><span>P2</span><span>P3</span><span>P4</span><span>P5</span></div><p className="chart-footnote">Current delivery score across active projects</p></section>
            <section className="feature-card standard-report-card"><h2>Budget utilization</h2><div className="budget-chart-wrap"><div className="budget-donut" role="img" aria-label="64 percent of project budget spent"><strong>64%</strong></div><div className="budget-labels"><span>Spent<strong>$118.5M</strong></span><span>Of budget<strong>$185.2M</strong></span></div></div></section>
            <section className="feature-card standard-report-card"><div className="feature-card-heading"><h2>Milestone trend</h2><span className="milestone-trend-legend"><i />Planned <b />Actual</span></div><svg className="milestone-trend-chart" viewBox="0 0 300 160" role="img" aria-label="Planned and actual milestone trend"><path d="M25 135 H290 M25 95 H290 M25 55 H290 M25 15 H290" className="chart-grid-line" /><polyline points="25,128 80,100 135,77 190,54 245,30 280,14" className="trend-planned-line" /><polyline points="25,130 80,112 135,96 190,82 245,66 280,48" className="trend-actual-line" />{[[25,130],[80,112],[135,96],[190,82],[245,66],[280,48]].map(([x,y]) => <circle key={x} cx={x} cy={y} r="3.5" className="trend-actual-point" />)}</svg><div className="trend-axis-labels"><span>Oct 1</span><span>Oct 11</span><span>Oct 21</span><span>Oct 31</span></div></section>
          </div>
          <section className="feature-card recent-reports-card">
            <div className="feature-card-heading"><h2>Recent reports</h2><span className="record-count">{recentReports.length} reports</span></div>
            <div className="responsive-table-wrap"><table className="feature-table recent-reports-table"><thead><tr><th>Report</th><th>Type</th><th>Created by</th><th>Date</th><th>Status</th><th>Open</th></tr></thead><tbody>{recentReports.map((report) => <tr key={report.title}><td><strong>{report.title}</strong></td><td>Project performance</td><td>{report.createdBy}</td><td>{report.date}</td><td><span className="status-pill status-completed">Completed</span></td><td><button type="button" className="table-action-button" onClick={() => openSavedReport(report.type)}>Open</button></td></tr>)}</tbody></table></div>
          </section>
        </>
      ) : null}

      {libraryTab === "Saved reports" ? (
        <section className="feature-card report-library-panel"><div className="feature-card-heading"><div><h2>Saved reports</h2><p>Open a report to review or export its latest data.</p></div></div><div className="report-highlight-list">{recentReports.map((report) => <article className="report-highlight" key={report.title}><span className="highlight-rank">▤</span><span className="highlight-copy"><strong>{report.title}</strong><small>{report.type} · saved {report.date}</small></span><button type="button" className="table-action-button" onClick={() => openSavedReport(report.type)}>Open report</button></article>)}</div></section>
      ) : null}

      {libraryTab === "Scheduled reports" ? (
        <section className="feature-card report-library-panel">
          <div className="feature-card-heading"><div><h2>Scheduled reports</h2><p>Manage recurring report delivery.</p></div><button type="button" className="secondary-button" onClick={() => setShowScheduleForm((show) => !show)}>＋ Add schedule</button></div>
          {showScheduleForm ? (
            <form className="schedule-form" onSubmit={saveSchedule}>
              <label>Report name<input required maxLength={80} value={scheduleName} onChange={(event) => setScheduleName(event.target.value)} placeholder="e.g. Monthly project health" /></label>
              <label>Frequency<select value={scheduleFrequency} onChange={(event) => setScheduleFrequency(event.target.value)}><option>Weekly</option><option>Monthly</option></select></label>
              <button type="submit" className="primary-button">Save schedule</button>
            </form>
          ) : null}
          <article className="scheduled-report-row"><span><strong>{scheduledReportName}</strong><small>{scheduleFrequency} · Project managers · PDF</small></span><span className={`status-pill ${scheduled ? "status-completed" : "status-monitoring"}`}>{scheduled ? "Active" : "Paused"}</span><button type="button" className="table-action-button" onClick={() => setScheduled((active) => !active)}>{scheduled ? "Pause" : "Resume"}</button></article>
        </section>
      ) : null}

      {libraryTab === "Custom reports" ? (
        <section className="feature-card report-library-panel custom-report-panel"><div className="feature-card-heading"><div><h2>Custom reports</h2><p>Choose a report subject and reporting period before generating a tailored export.</p></div></div><div className="custom-report-fields"><label>Report subject<select value={tab} onChange={(event) => setTab(event.target.value as ReportTab)}>{reportTabs.map((item) => <option key={item}>{item}</option>)}</select></label><label>Summary period<select value={period} onChange={(event) => setPeriod(event.target.value as ReportPeriod)}>{(["Daily", "Weekly", "Monthly", "Yearly"] as ReportPeriod[]).map((item) => <option key={item}>{item}</option>)}</select></label><button type="button" className="primary-button" onClick={() => openReportDialog()}>Generate custom report</button></div></section>
      ) : null}

      {isReportDialogOpen ? (
        <div className="modal-backdrop report-modal-backdrop">
          <section className="feature-modal report-modal" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title">
            <div className="modal-heading">
              <div><span className="eyebrow">REPORT DOWNLOAD</span><h2 id="report-dialog-title">Choose report options</h2></div>
              <button type="button" className="modal-close" aria-label="Close report options" onClick={() => setIsReportDialogOpen(false)}>×</button>
            </div>
            <div className="feature-form">
              <label className="report-dialog-field">
                Reporting interval
                <select value={reportInterval} onChange={(event) => { setReportInterval(event.target.value as ReportInterval); setIsPreviewVisible(false); }}>
                  {(["Day", "Week", "Month", "Year"] as ReportInterval[]).map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="report-dialog-field">
                {reportInterval === "Day" ? "Select date" : `Select ${reportInterval.toLowerCase()}`}
                <input
                  aria-label={reportInterval === "Day" ? "Select date" : `Select ${reportInterval.toLowerCase()}`}
                  type={reportInterval === "Day" ? "date" : reportInterval === "Week" ? "week" : reportInterval === "Month" ? "month" : "number"}
                  min={reportInterval === "Year" ? "2000" : undefined}
                  max={reportInterval === "Year" ? "2100" : undefined}
                  value={reportValue}
                  required
                  onChange={(event) => {
                    if (reportInterval === "Day") setReportDay(event.target.value);
                    else if (reportInterval === "Week") setReportWeek(event.target.value);
                    else if (reportInterval === "Month") setReportMonth(event.target.value);
                    else setReportYear(event.target.value);
                    setIsPreviewVisible(false);
                  }}
                />
              </label>
              <label className="report-dialog-field">
                Format
                <select value={reportFormat} onChange={(event) => setReportFormat(event.target.value as ReportFormat)}>
                  <option value="PDF">PDF</option>
                  <option value="Excel">Excel-compatible CSV</option>
                </select>
              </label>
              {isPreviewVisible ? (
                <div className="report-preview">
                  <div className="feature-card-heading"><div><h3>Report preview</h3><p>{project} · {tab} · {reportRange}</p></div></div>
                  <div className="chart-legend"><span><i className="chart-on-track" />On track</span><span><i className="chart-at-risk" />At risk</span><span><i className="chart-delayed" />Delayed</span></div>
                  <ReportTrendChart period={reportPeriod} stats={periodDetails[reportPeriod]} />
                </div>
              ) : null}
              {exportMessage.startsWith("Unable to download") ? <p className="error" role="alert">{exportMessage}</p> : null}
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setIsReportDialogOpen(false)}>Cancel</button>
                <button type="button" className="secondary-button" disabled={!canPreviewReport} onClick={() => { applyReportSelection(); setIsPreviewVisible(true); }}>Preview</button>
                {isPreviewVisible ? <button type="button" className="primary-button" onClick={downloadReport}>Download Report</button> : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
