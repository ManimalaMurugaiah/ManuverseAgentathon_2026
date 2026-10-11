import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MilestonesPage } from "./MilestonesPage";
import { ProjectsPage } from "./ProjectsPage";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
const auth = vi.hoisted(() => ({ role: "manager" }));

vi.mock("../api/client", () => ({ default: api }));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { username: "tester", role: auth.role }, loading: false, login: vi.fn(), logout: vi.fn() }),
}));

const project = {
  id: 1, code: "PRJ001", name: "Alpha Expansion Plant", owner: "Ravi K.", country: null, plant: null, budget: null,
  status: "Execution", health: "On track", progress: 70, milestone_count: 2, start_date: "2026-10-10", end_date: "2026-12-20", ai_agents_enabled: true,
};

const milestones = {
  project_id: 1,
  project_name: "Alpha Expansion Plant",
  items: [
    { id: 11, project_id: 1, name: "Engineering Approval", owner: "Ravi K.", status: "Completed", progress: 100, due_date: "2026-10-10", forecast_date: null, actual_date: "2026-10-10", critical: true },
    { id: 12, project_id: 1, name: "Material Delivery", owner: "Vikram N.", status: "In Progress", progress: 60, due_date: "2026-10-25", forecast_date: null, actual_date: null, critical: false },
  ],
};

const approvals = {
  milestone_id: 12,
  milestone_name: "Material Delivery",
  steps: [
    { id: 1, step_no: 1, name: "Evidence submitted", actor: "Vikram N.", status: "Done" },
    { id: 2, step_no: 2, name: "Engineering Lead review", actor: "Engineering Lead", status: "Done" },
    { id: 3, step_no: 3, name: "Procurement approval", actor: "Procurement Lead", status: "Pending" },
    { id: 4, step_no: 4, name: "Milestone closed", actor: "System", status: "Waiting" },
  ],
  evidence: [{ id: 1, file_name: "Delivery_note.pdf", uploaded_by: "tester", uploaded_at: "2026-10-11T10:00:00" }],
};

function mockGet() {
  api.get.mockImplementation((url: string) => {
    if (url === "/projects") return Promise.resolve({ data: { items: [project], total: 1, page: 1, page_size: 6, owners: ["Ravi K."] } });
    if (url === "/projects/1/milestones") return Promise.resolve({ data: milestones });
    if (url === "/milestones/12/approvals") return Promise.resolve({ data: approvals });
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
  it("lists projects from the API with health and progress", async () => {
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>);

    expect(await screen.findByText("Alpha Expansion Plant")).toBeTruthy();
    const row = screen.getByRole("row", { name: /Alpha Expansion Plant/ });
    expect(within(row).getByText("On track")).toBeTruthy();
    expect(within(row).getByText("70%")).toBeTruthy();
    expect(screen.getByText("Showing 1–1 of 1 projects")).toBeTruthy();
  });

  it("creates a project and posts the entered details", async () => {
    api.post.mockResolvedValue({ data: project });
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>);
    await screen.findByText("Alpha Expansion Plant");

    fireEvent.click(screen.getByRole("button", { name: /Create project/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Project name"), { target: { value: "Digital Twin" } });
    fireEvent.change(within(dialog).getByLabelText("Start date"), { target: { value: "2026-10-10" } });
    fireEvent.change(within(dialog).getByLabelText("End date"), { target: { value: "2026-11-30" } });
    fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith("/projects", expect.objectContaining({ name: "Digital Twin", owner: "tester", start_date: "2026-10-10", end_date: "2026-11-30" }));
  });

  it("blocks an end date before the start date without calling the API", async () => {
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>);
    await screen.findByText("Alpha Expansion Plant");

    fireEvent.click(screen.getByRole("button", { name: /Create project/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Project name"), { target: { value: "Digital Twin" } });
    fireEvent.change(within(dialog).getByLabelText("Start date"), { target: { value: "2026-11-30" } });
    fireEvent.change(within(dialog).getByLabelText("End date"), { target: { value: "2026-10-01" } });
    fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);

    expect((await screen.findByRole("alert")).textContent).toContain("End date must not be before");
    expect(api.post).not.toHaveBeenCalled();
  });

  it("hides create actions from viewers", async () => {
    auth.role = "viewer";
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>);
    await screen.findByText("Alpha Expansion Plant");

    expect(screen.queryByRole("button", { name: /Create project/ })).toBeNull();
  });
});

describe("MilestonesPage", () => {
  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={["/projects/1/milestones"]}>
        <Routes><Route path="/projects/:projectId/milestones" element={<MilestonesPage />} /></Routes>
      </MemoryRouter>,
    );

  it("shows milestones, selects the current one and loads its approval workflow", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: /Milestones · Alpha Expansion Plant/ })).toBeTruthy();
    expect(await screen.findByText("Procurement approval")).toBeTruthy();
    expect(screen.getByText("Delivery_note.pdf")).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith("/milestones/12/approvals");
  });

  it("lets a manager approve the pending step", async () => {
    api.post.mockResolvedValue({ data: { ...approvals, steps: approvals.steps.map((s) => ({ ...s, status: "Done" })) } });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Approve: Procurement approval/ }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/milestones/12/approvals/advance"));
  });

  it("does not offer the procurement approval to an engineering user", async () => {
    auth.role = "engineering";
    renderPage();
    await screen.findByText("Procurement approval");

    expect(screen.queryByRole("button", { name: /Approve:/ })).toBeNull();
  });

  it("adds a milestone through the form", async () => {
    api.post.mockResolvedValue({ data: { ...milestones.items[1], id: 13, name: "Installation" } });
    renderPage();
    await screen.findByText("Procurement approval");

    fireEvent.click(screen.getByRole("button", { name: /Add milestone/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Milestone name"), { target: { value: "Installation" } });
    fireEvent.change(within(dialog).getByLabelText("Owner"), { target: { value: "Kavitha R." } });
    fireEvent.change(within(dialog).getByLabelText("Due date"), { target: { value: "2026-10-30" } });
    fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/projects/1/milestones", expect.objectContaining({ name: "Installation", owner: "Kavitha R.", status: "Not Started", progress: 0 })));
  });
});
