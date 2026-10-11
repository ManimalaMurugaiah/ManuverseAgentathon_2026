import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Layout } from "../components/Layout";
import { ProjectsPage } from "./ProjectsPage";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
const auth = vi.hoisted(() => ({ role: "manager" }));

vi.mock("../api/client", () => ({ default: api }));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { username: "tester", role: auth.role }, loading: false, login: vi.fn(), logout: vi.fn() }),
}));

const project = {
  id: 1, code: "PRJ001", name: "Alpha Expansion Plant", project_type: "Expansion", owner: "Ravi K.", business: "Pumps",
  country: "India", plant: "Plant A", location: null, budget: "250000", budget_spent: "0", status: "Execution",
  schedule_status: "On track", health: "Good", progress: 70, milestone_count: 2, start_date: "2026-10-10",
  end_date: "2026-12-20", forecast_date: null, ai_agents_enabled: true,
};

const lookups = {
  project_types: ["Expansion", "New Installation"], lifecycle_statuses: ["Planning", "Execution"], risk_levels: ["Low", "High"],
  action_statuses: ["Open"], owners: ["Ravi K."], plants: ["Plant A"], countries: ["India"], businesses: ["Pumps"],
  templates: [{ id: 1, name: "Manufacturing Project Delivery", stage_count: 13 }], roles: ["admin"],
};

function mockGet() {
  api.get.mockImplementation((url: string) => {
    if (url === "/projects") return Promise.resolve({ data: { items: [project], total: 1, page: 1, page_size: 6, owners: ["Ravi K."], plants: ["Plant A"], businesses: ["Pumps"] } });
    if (url === "/projects/summary") return Promise.resolve({ data: { total: 1, on_track: 1, at_risk: 0, delayed: 0, completed: 0 } });
    if (url === "/projects/next-code") return Promise.resolve({ data: { code: "PRJ002" } });
    if (url === "/lookups") return Promise.resolve({ data: lookups });
    if (url === "/risks") return Promise.resolve({ data: { items: [], total: 0, open_count: 0 } });
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

beforeEach(() => {
  auth.role = "manager";
  mockGet();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProjectsPage", () => {
  it("lists projects from the API", async () => {
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>);

    expect(await screen.findByText("Alpha Expansion Plant")).toBeTruthy();
    const row = screen.getByRole("row", { name: /Alpha Expansion Plant/ });
    expect(within(row).getByText("PRJ001")).toBeTruthy();
    expect(within(row).getByText("70%")).toBeTruthy();
    expect(screen.getByText("Showing 1–1 of 1 projects")).toBeTruthy();
  });

  it("hides Create Project from viewers", async () => {
    auth.role = "viewer";
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>);
    await screen.findByText("Alpha Expansion Plant");

    expect(screen.queryByRole("button", { name: /Create Project/ })).toBeNull();
  });

  it("opens the wizard with the next project code and advances to step 2", async () => {
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>);
    await screen.findByText("Alpha Expansion Plant");

    fireEvent.click(screen.getByRole("button", { name: /Create Project/ }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect((within(dialog).getByLabelText(/^Project ID/) as HTMLInputElement).value).toBe("PRJ002"));

    fireEvent.change(within(dialog).getByLabelText(/^Project Name/), { target: { value: "Digital Twin" } });
    fireEvent.change(within(dialog).getByLabelText(/^Project Type/), { target: { value: "Expansion" } });
    fireEvent.change(within(dialog).getByLabelText(/^Plant/), { target: { value: "Plant A" } });
    fireEvent.change(within(dialog).getByLabelText(/^Description/), { target: { value: "Twin of the line" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Next/ }));

    expect(await within(dialog).findByRole("heading", { name: "Scope & Timeline" })).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe("Layout", () => {
  it("builds the business selector from lookups and links to all menus", async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<div>content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("option", { name: "Pumps" })).toBeTruthy();
    for (const name of ["Overview", "Projects", "Milestones", "Dependencies", "Risks & Issues", "Actions", "Reports"]) {
      expect(screen.getByRole("link", { name })).toBeTruthy();
    }
  });
});
