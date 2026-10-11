import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ProjectsPage } from "./ProjectsPage";

afterEach(cleanup);

describe("ProjectsPage", () => {
  it("supports pagination, project search, owner/status filters, and AI agent toggles", () => {
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>);

    expect(screen.queryByText("Start a project")).toBeNull();
    expect(screen.getByText("Showing 1–6 of 12 projects")).toBeTruthy();
    expect(screen.getByText("Alpha – Expansion Plant")).toBeTruthy();
    expect(screen.queryByText("Northstar Rolling Mill Modernization")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Showing 7–12 of 12 projects")).toBeTruthy();
    expect(screen.getByText("Northstar Rolling Mill Modernization")).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "Search projects" }), { target: { value: "Supplier" } });
    expect(screen.getByText("Showing 1–1 of 1 projects")).toBeTruthy();
    expect(screen.getByText("Supplier Onboarding")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear project search" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by status" }), { target: { value: "Delayed" } });
    expect(screen.getByText("Showing 1–2 of 2 projects")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by owner" }), { target: { value: "Michael T." } });
    expect(screen.getByText("Showing 1–1 of 1 projects")).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox", { name: "Filter by status" }), { target: { value: "All status" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by owner" }), { target: { value: "All owners" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Search projects" }), { target: { value: "Alpha" } });
    const toggle = screen.getByRole("switch", { name: "Disable AI agents for Alpha – Expansion Plant" });
    fireEvent.click(toggle);
    expect(screen.getByRole("switch", { name: "Enable AI agents for Alpha – Expansion Plant" }).getAttribute("aria-checked")).toBe("false");
  });

  it("creates a project from the project wizard and opens project details", () => {
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: "＋ Create project" }));
    const dialog = screen.getByRole("dialog", { name: "Create a project" });
    fireEvent.change(within(dialog).getByLabelText("Project name"), { target: { value: "Factory Controls Upgrade" } });
    fireEvent.change(within(dialog).getByLabelText("Project owner"), { target: { value: "Alex Morgan" } });
    fireEvent.change(within(dialog).getByLabelText("Start date"), { target: { value: "2026-11-01" } });
    fireEvent.change(within(dialog).getByLabelText("End date"), { target: { value: "2027-03-31" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create project" }));

    expect(screen.getByText("Showing 1–6 of 13 projects")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Factory Controls Upgrade/ }));
    expect(screen.getByRole("dialog", { name: "Factory Controls Upgrade" })).toBeTruthy();
    expect(within(screen.getByRole("dialog", { name: "Factory Controls Upgrade" })).getByText("Alex Morgan")).toBeTruthy();
  });
});
