import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "../context/AuthContext";
import { ActionsPage } from "./ActionsPage";
import { ReportsPage } from "./ReportsPage";
import { RisksIssuesPage } from "./RisksIssuesPage";
import { SettingsPage } from "./SettingsPage";

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

  it("creates an action from the action form", () => {
    vi.stubGlobal("localStorage", { getItem: () => null, removeItem: () => undefined, setItem: () => undefined });
    render(<BrowserRouter><AuthProvider><ActionsPage /></AuthProvider></BrowserRouter>);

    fireEvent.click(screen.getByRole("button", { name: /Create Action/ }));
    fireEvent.change(screen.getByLabelText("Action title"), { target: { value: "Inspect line guard" } });
    fireEvent.change(screen.getByLabelText("Owner"), { target: { value: "Safety Team" } });
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-11-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Action" }));

    expect(screen.getByText("Inspect line guard")).toBeTruthy();
    expect(screen.getByText("Safety Team")).toBeTruthy();
  });

  it("removes the duration selector and changes report type", () => {
    render(<BrowserRouter><ReportsPage /></BrowserRouter>);

    fireEvent.click(screen.getByRole("tab", { name: /Risk Report/ }));

    expect(screen.queryByLabelText("Duration")).toBeNull();
    expect(screen.getByText("24", { exact: true })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Risk Report/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("previews a selected reporting interval and offers an Excel-compatible export format", () => {
    render(<BrowserRouter><ReportsPage /></BrowserRouter>);

    fireEvent.click(screen.getByRole("button", { name: "Download Report" }));
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

    fireEvent.click(screen.getByRole("button", { name: "Download Report" }));
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

    fireEvent.click(screen.getByRole("button", { name: "Download Report" }));
    fireEvent.change(screen.getByLabelText("Format"), { target: { value: "Excel" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Preview" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Download Report" }));

    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(clickDownload).toHaveBeenCalledOnce();
    expect(createObjectUrl.mock.calls[0][0].type).toBe("text/csv;charset=utf-8");
    expect(screen.getByRole("status").textContent).toBe("Excel-compatible CSV downloaded.");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("switches settings sections and notification preferences", () => {
    render(<BrowserRouter><SettingsPage /></BrowserRouter>);

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    const smsSwitches = screen.getAllByRole("switch", { name: "SMS notifications" });
    fireEvent.click(smsSwitches[smsSwitches.length - 1]);

    expect(screen.getByText("Notification preferences")).toBeTruthy();
    expect(smsSwitches[smsSwitches.length - 1].getAttribute("aria-checked")).toBe("true");
  });

  it("adds an invite to the demo user roster", () => {
    render(<BrowserRouter><SettingsPage /></BrowserRouter>);

    fireEvent.click(screen.getByRole("button", { name: "Users & Roles" }));
    fireEvent.click(screen.getByRole("button", { name: /Invite user/ }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Morgan Lee" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "morgan@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Invite" }));

    expect(screen.getByText("morgan@example.com")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Demo invitation created for morgan@example.com.");
  });
});
