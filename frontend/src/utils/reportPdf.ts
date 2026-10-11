export interface PdfBucket {
  label: string;
  on_track: number;
  at_risk: number;
  delayed: number;
  total: number;
}

export interface PdfReport {
  title: string;
  project: string;
  interval: string;
  totals: { onTrack: number; atRisk: number; delayed: number; milestones: number };
  buckets: PdfBucket[];
  headers: string[];
  rows: string[][];
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const WRAP_COLUMNS = 88;

function escapePdfText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/[\\()]/g, "\\$&");
}

export function createReportPdf(report: PdfReport): Blob {
  const { title, project, interval, totals, buckets, headers, rows } = report;
  const pages: string[][] = [[]];
  let currentPage = pages[0];
  let currentY = 752;

  const addText = (text: string, size = 10, color = "0.16 0.23 0.34") => {
    currentPage.push(`${color} rg BT /F1 ${size} Tf 1 0 0 1 50 ${currentY} Tm (${escapePdfText(text)}) Tj ET`);
    currentY -= size + 6;
  };
  const addWrappedText = (text: string) => {
    let line = "";
    for (const word of text.split(/\s+/)) {
      if (line && `${line} ${word}`.length > WRAP_COLUMNS) {
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
  addText(`On track: ${totals.onTrack}       At risk: ${totals.atRisk}       Delayed: ${totals.delayed}       Total: ${totals.milestones}`);
  currentY = 616;
  addText("Milestone status trend", 12, "0.10 0.20 0.36");

  const chartLeft = 72;
  const chartBottom = 516;
  const chartMaxHeight = 70;
  const barWidth = 26;
  const step = Math.min(68, Math.floor(470 / Math.max(buckets.length, 1)));
  const maxTotal = Math.max(1, ...buckets.map((bucket) => bucket.total));
  currentPage.push(`0.88 0.91 0.95 RG 1 w ${chartLeft - 8} ${chartBottom} m 545 ${chartBottom} l S`);
  buckets.forEach((bucket, index) => {
    const x = chartLeft + index * step;
    const barHeight = bucket.total ? Math.max(8, (bucket.total / maxTotal) * chartMaxHeight) : 0;
    const onTrackHeight = bucket.total ? (barHeight * bucket.on_track) / bucket.total : 0;
    const atRiskHeight = bucket.total ? (barHeight * bucket.at_risk) / bucket.total : 0;
    const delayedHeight = barHeight - onTrackHeight - atRiskHeight;
    if (barHeight > 0) {
      currentPage.push(
        `0.13 0.68 0.48 rg ${x} ${chartBottom} ${barWidth} ${onTrackHeight.toFixed(2)} re f`,
        `0.95 0.68 0.22 rg ${x} ${(chartBottom + onTrackHeight).toFixed(2)} ${barWidth} ${atRiskHeight.toFixed(2)} re f`,
        `0.91 0.32 0.35 rg ${x} ${(chartBottom + onTrackHeight + atRiskHeight).toFixed(2)} ${barWidth} ${delayedHeight.toFixed(2)} re f`,
      );
    }
    currentPage.push(`0.35 0.42 0.53 rg BT /F1 8 Tf 1 0 0 1 ${x - 2} ${chartBottom - 14} Tm (${escapePdfText(bucket.label)}) Tj ET`);
    currentPage.push(`0.25 0.33 0.45 rg BT /F1 8 Tf 1 0 0 1 ${x + 6} ${(chartBottom + barHeight + 5).toFixed(2)} Tm (${bucket.total}) Tj ET`);
  });

  currentY = 476;
  addText("Report details", 13, "0.10 0.20 0.36");
  addWrappedText(headers.join(" | "));
  currentY -= 4;
  for (const row of rows) {
    const wrappedRow = row.join(" | ");
    const lineCount = Math.max(1, Math.ceil(wrappedRow.length / WRAP_COLUMNS));
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
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
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

export const csvCell = (value: unknown): string => `"${String(value ?? "").replace(/"/g, '""')}"`;

export function isoWeek(date: Date): string {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
