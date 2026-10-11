import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "../context/AuthContext";
import { ActionsPage } from "./ActionsPage";
import { DependenciesPage } from "./DependenciesPage";
import { MilestonesPage } from "./MilestonesPage";
import { ReportsPage } from "./ReportsPage";
import { RisksIssuesPage } from "./RisksIssuesPage";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("operations pages", () => {
  it("filters businesses and shows a selected risk's line and timestamp", () => {
    window.history.replaceState({}, "", "/?business=Northstar%20Steel%20Works");
    render(<BrowserRouter><RisksIssuesPage /></BrowserRouter>);

    fireEvent.click(screen.getByRole("button", { name: /Rolling mill vibration trending upward/ }));

    expect(screen.getByText("Rolling Mill Line 1")).toBeTruthy();
    expect(screen.getByText("Hot rolling · Mill Stand M-08")).toBeTruthy();
    expect(screen.getByText("Oct 9, 2026, 7:28 AM")).toBeTruthy();
  });

  it("provides accessible risk filters, matrix labels, and an add-risk form", () => {
    window.history.replaceState({}, "", "/");
    render(<BrowserRouter><RisksIssuesPage /></BrowserRouter>);

    expect(screen.getByRole("grid", { name: "Open risk matrix" })).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by type" }), { target: { value: "Issue" } });
    expect(within(screen.getByRole("table", { name: "Risk and issue register" })).getAllByRole("row")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: /Add risk \/ issue/i }));
    const dialog = screen.getByRole("dialog", { name: "Add risk or issue" });
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Guard inspection overdue" } });
    fireEvent.change(within(dialog).getByLabelText("Owner"), { target: { value: "Safety Team" } });
    fireEvent.change(within(dialog).getByLabelText("Due date"), { target: { value: "2026-11-18" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Add risk \/ issue/i }));
    expect(within(screen.getByRole("table", { name: "Risk and issue register" })).getByText("Guard inspection overdue")).toBeTruthy();
  });

  it("creates an action from the action form", () => {
    vi.stubGlobal("localStorage", { getItem: () => null, removeItem: () => undefined, setItem: () => undefined });
    render(<BrowserRouter><AuthProvider><ActionsPage /></AuthProvider></BrowserRouter>);

    fireEvent.click(screen.getByRole("button", { name: /Create Action/i }));
    fireEvent.change(screen.getByLabelText("Action title"), { target: { value: "Inspect line guard" } });
    fireEvent.change(screen.getByLabelText("Owner"), { target: { value: "Safety Team" } });
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-11-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Action" }));

    expect(screen.getByText("Inspect line guard")).toBeTruthy();
    expect(screen.getByText("Safety Team")).toBeTruthy();
  });

  it("filters the action register and processes an approval", () => {
    vi.stubGlobal("localStorage", { getItem: () => null, removeItem: () => undefined, setItem: () => undefined });
    render(<BrowserRouter><AuthProvider><ActionsPage /></AuthProvider></BrowserRouter>);

    expect(screen.getByRole("table").getAttribute("class")).toContain("action-table");
    fireEvent.change(screen.getByRole("combobox", { name: "Filter action agents" }), { target: { value: "Manual" } });
    expect(within(screen.getByRole("table")).queryByText("Confirm material delivery schedule")).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Filter action agents" }), { target: { value: "All agents" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Approve" })[0]);
    expect(screen.getByRole("status").textContent).toContain("approved.");
  });

  it("shows report library tabs and opens a saved report", () => {
    render(<BrowserRouter><ReportsPage /></BrowserRouter>);

    expect(screen.getByRole("img", { name: "Project performance across five projects" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "64 percent of project budget spent" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Planned and actual milestone trend" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Saved reports" }));
    expect(screen.queryByLabelText("Duration")).toBeNull();
    expect(screen.getByText("Risk and issue analysis")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Open report" })[1]);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Choose report options" })).toBeTruthy();
  });

  it("creates and pauses a scheduled report using labeled controls", () => {
    render(<BrowserRouter><ReportsPage /></BrowserRouter>);
    fireEvent.click(screen.getByRole("tab", { name: "Scheduled reports" }));
    fireEvent.click(screen.getByRole("button", { name: "＋ Add schedule" }));
    fireEvent.change(screen.getByLabelText("Report name"), { target: { value: "Monthly operations" } });
    fireEvent.change(screen.getByLabelText("Frequency"), { target: { value: "Monthly" } });
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));

    expect(screen.getByText("Monthly operations")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Monthly report schedule saved.");
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByText("Paused")).toBeTruthy();
  });

  it("previews a selected reporting interval and offers an Excel-compatible export format", () => {
    render(<BrowserRouter><ReportsPage /></BrowserRouter>);

    fireEvent.click(screen.getByRole("button", { name: "Generate report" }));
    expect(screen.getByLabelText("Reporting interval").textContent).toContain("Day");
    expect(screen.getByLabelText("Reporting interval").textContent).toContain("Week");
    expect(screen.getByLabelText("Reporting interval").textContent).toContain("Month");
    expect(screen.getByLabelText("Reporting interval").textContent).toContain("Year");
    fireEvent.change(screen.getByLabelText("Reporting interval"), { target: { value: "Day" } });
    expect(screen.getByLabelText("Select date")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Reporting interval"), { target: { value: "Week" } });
    expect(screen.getByLabelText("Select week")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Reporting interval"), { target: { value: "Month" } });
    expect(screen.getByLabelText("Select month")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Select month"), { target: { value: "2026-09" } });
    fireEvent.change(screen.getByLabelText("Reporting interval"), { target: { value: "Year" } });
    expect(screen.getByLabelText("Select year")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Reporting interval"), { target: { value: "Month" } });
    fireEvent.change(screen.getByLabelText("Select month"), { target: { value: "2026-09" } });
    fireEvent.change(screen.getByLabelText("Format"), { target: { value: "Excel" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(within(screen.getByRole("dialog")).getByText(/September 2026/)).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByRole("img", { name: "Monthly milestone status trend" })).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "Format" }) as HTMLSelectElement).value).toBe("Excel");
    expect(screen.getByRole("option", { name: "Excel-compatible CSV" })).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Download Report" })).toBeTruthy();
    expect(screen.queryByText("Export this report")).toBeNull();
  });

  it("downloads a PDF directly without opening the print dialog", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(<BrowserRouter><ReportsPage /></BrowserRouter>);
    const createObjectUrl = vi.fn((_blob: Blob) => "blob:report");
    vi.stubGlobal("URL", { createObjectURL: createObjectUrl, revokeObjectURL: vi.fn() });
    const clickDownload = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    fireEvent.click(screen.getByRole("button", { name: "Generate report" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Download Report" }));
    const pdfBlob = createObjectUrl.mock.calls[0][0];
    const pdfContent = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(pdfBlob);
    });

    expect(pdfBlob.type).toBe("application/pdf");
    expect(pdfContent.startsWith("%PDF-1.4")).toBe(true);
    expect(pdfContent).toContain("xref");
    expect(pdfContent).toContain("Project Health");
    expect(pdfContent).toContain("Milestone status trend");
    const crossReferenceOffset = Number(pdfContent.match(/startxref\n(\d+)/)?.[1]);
    expect(pdfContent.slice(crossReferenceOffset).startsWith("xref\n")).toBe(true);
    const objectOffsets = [...pdfContent.matchAll(/(\d{10}) 00000 n/g)].map((match) => Number(match[1]));
    objectOffsets.forEach((offset, index) => {
      expect(pdfContent.slice(offset).startsWith(`${index + 1} 0 obj\n`)).toBe(true);
    });
    expect(clickDownload).toHaveBeenCalledOnce();
    expect(print).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("PDF report downloaded.");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("downloads the selected report as an Excel-compatible CSV", async () => {
    render(<BrowserRouter><ReportsPage /></BrowserRouter>);
    const createObjectUrl = vi.fn((_blob: Blob) => "blob:report");
    vi.stubGlobal("URL", { createObjectURL: createObjectUrl, revokeObjectURL: vi.fn() });
    const clickDownload = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    fireEvent.click(screen.getByRole("button", { name: "Generate report" }));
    fireEvent.change(screen.getByLabelText("Format"), { target: { value: "Excel" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Preview" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Download Report" }));

    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(clickDownload).toHaveBeenCalledOnce();
    expect(createObjectUrl.mock.calls[0][0].type).toBe("text/csv;charset=utf-8");
    expect(screen.getByRole("status").textContent).toBe("Excel-compatible CSV downloaded.");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("adds milestones and records approval actions", () => {
    render(<BrowserRouter><MilestonesPage /></BrowserRouter>);

    expect(screen.getByRole("table", { name: "Milestone register" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByRole("status").textContent).toBe("Approval recorded.");
    fireEvent.click(screen.getByRole("button", { name: "＋ Add milestone" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(screen.getByLabelText("Milestone name"), { target: { value: "Safety sign-off" } });
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-11-20" } });
    fireEvent.change(screen.getByLabelText("Owner"), { target: { value: "Safety Team" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add milestone" }));
    expect(within(screen.getByRole("table", { name: "Milestone register" })).getByText("Safety sign-off")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Milestone added.");
  });

  it("exposes dependency views and runs a schedule simulation", () => {
    render(<BrowserRouter><DependenciesPage /></BrowserRouter>);

    fireEvent.click(screen.getByRole("button", { name: "Equipment Delivery, 22 Oct, Delayed" }));
    expect(screen.getByRole("status").textContent).toContain("Equipment Delivery");
    fireEvent.click(screen.getByRole("tab", { name: "Bottleneck analysis" }));
    expect(screen.getByText(/current bottleneck/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Impact simulation" }));
    fireEvent.click(screen.getByRole("button", { name: "Simulate 2-day delay" }));
    expect(screen.getByRole("status").textContent).toContain("Installation shifts");
  });
});
