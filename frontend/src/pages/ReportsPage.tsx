import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { sampleActions, sampleBusinesses, sampleRisks } from "./sampleData";

type ReportTab = "Project Health" | "Milestone Report" | "Risk Report" | "Action Report" | "Dependency Report";
type ReportPeriod = "Daily" | "Weekly" | "Monthly" | "Yearly";
type ReportInterval = "Day" | "Week" | "Month" | "Year";
type ReportFormat = "PDF" | "Excel";

const reportTabs: ReportTab[] = ["Project Health", "Milestone Report", "Risk Report", "Action Report", "Dependency Report"];
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

  return (
    <section className="feature-page reports-page">
      <header className="feature-heading">
        <div><span className="eyebrow">PROJECT INTELLIGENCE · DEMO DATA</span><h1>Reports</h1><p>Understand project health, milestones, risks, and actions at a glance.</p></div>
        <div className="report-controls">
          <label className="report-select"><span>Project</span><select value={project} onChange={(event) => setProject(event.target.value)}>{reportProjects.map((code) => <option key={code}>{code}</option>)}</select></label>
          <button type="button" className="primary-button report-export-primary" onClick={() => { setExportMessage(""); setIsPreviewVisible(false); setIsReportDialogOpen(true); }}><span aria-hidden="true">⤓</span> Download Report</button>
        </div>
      </header>
      <div className="demo-data-note"><span aria-hidden="true">ⓘ</span> Illustrative sample report · {displayRange} · Values are for preview only.</div>
      {exportMessage ? <p className="export-feedback" role="status">{exportMessage}</p> : null}

      <nav className="report-tabs feature-card" role="tablist" aria-label="Report type">
        {reportTabs.map((item, index) => <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? "is-selected" : ""} onClick={() => { setTab(item); setExportMessage(""); }}><span aria-hidden="true">{["◉", "▦", "⚠", "✓", "⌘"][index]}</span>{item}</button>)}
      </nav>

      <div className="feature-metrics report-metrics">
        <article className="feature-metric metric-green"><span>On track</span><strong>{stats.onTrack}</strong><small>Milestones progressing</small></article>
        <article className="feature-metric metric-amber"><span>At risk</span><strong>{stats.atRisk}</strong><small>Need attention</small></article>
        <article className="feature-metric metric-red"><span>Delayed</span><strong>{stats.delayed}</strong><small>Behind planned date</small></article>
        <article className="feature-metric metric-blue"><span>Total milestones</span><strong>{stats.milestones}</strong><small>In this reporting period</small></article>
      </div>

      <div className="report-content-grid">
        <section className="feature-card report-trend-card">
          <div className="feature-card-heading"><div><h2>{tab} overview</h2><p>{project} · {period} summary</p></div><span className="report-period-badge">{period}</span></div>
          <ReportTrendChart period={period} stats={stats} />
          <div className="chart-legend"><span><i className="chart-on-track" />On track</span><span><i className="chart-at-risk" />At risk</span><span><i className="chart-delayed" />Delayed</span></div>
          <div className="report-narrative"><strong>What this means</strong><p>{stats.onTrack} milestones are on track. Review the {stats.atRisk} at-risk items and assign owners to reduce schedule pressure{stats.delayed ? `; ${stats.delayed} ${stats.delayed === 1 ? "item is" : "items are"} already delayed` : ""}.</p></div>
        </section>

        <section className="feature-card report-highlights-card">
          <div className="feature-card-heading"><div><h2>{tab === "Risk Report" ? "Top risks" : tab === "Action Report" ? "Priority actions" : tab === "Dependency Report" ? "Key dependencies" : "Key milestones"}</h2><p>Items to review for {project}</p></div></div>
          <div className="report-highlight-list">
            {(tab === "Risk Report" ? projectRisks.slice(0, 4).map((risk) => ({ title: risk.title, detail: `${risk.line} · ${risk.owner}`, status: risk.severity }))
              : tab === "Action Report" ? projectActions.slice(0, 4).map((action) => ({ title: action.title, detail: `${action.owner} · due ${action.dueDate}`, status: action.status }))
                : tab === "Dependency Report" ? dependencyRows.map((dependency) => ({ title: dependency.dependency, detail: `${dependency.owner} · ${dependency.due}`, status: dependency.status }))
                  : milestoneRows.map((milestone) => ({ title: milestone.milestone, detail: `${milestone.owner} · ${milestone.planned}`, status: milestone.status })).slice(0, 4)
            ).map((item, index) => (
              <article className="report-highlight" key={`${item.title}-${index}`}>
                <span className="highlight-rank">{index + 1}</span><span className="highlight-copy"><strong>{item.title}</strong><small>{item.detail}</small></span><span className={`status-pill status-${item.status.toLowerCase().replace(" ", "-")}`}>{item.status}</span>
              </article>
            ))}
            {tab === "Risk Report" && projectRisks.length === 0 ? <p className="muted">No demo risks for this project.</p> : null}
            {tab === "Action Report" && projectActions.length === 0 ? <p className="muted">No demo actions for this project.</p> : null}
          </div>
        </section>
      </div>

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
