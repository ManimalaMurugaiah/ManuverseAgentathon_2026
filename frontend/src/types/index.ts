export type Role = "admin" | "manager" | "engineering" | "approver" | "viewer";

export interface UserInfo {
  username: string;
  role: Role;
}

export interface WorkflowRun {
  id: number;
  project_code: string;
  current_stage: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardSummary {
  total_runs: number;
  running: number;
  blocked: number;
  completed: number;
}

export type ProjectHealth = "On track" | "At risk" | "Delayed";
export type MilestoneStatus = "Not Started" | "In Progress" | "Completed" | "Delayed" | "At Risk";

export interface Project {
  id: number;
  code: string | null;
  name: string;
  owner: string | null;
  country: string | null;
  plant: string | null;
  budget: string | null;
  status: string | null;
  health: ProjectHealth;
  progress: number;
  milestone_count: number;
  start_date: string | null;
  end_date: string | null;
  ai_agents_enabled: boolean;
}

export interface ProjectList {
  items: Project[];
  total: number;
  page: number;
  page_size: number;
  owners: string[];
}

export interface Milestone {
  id: number;
  project_id: number;
  name: string;
  owner: string | null;
  status: MilestoneStatus;
  progress: number;
  due_date: string | null;
  forecast_date: string | null;
  actual_date: string | null;
  critical: boolean;
}

export interface MilestoneList {
  project_id: number;
  project_name: string;
  items: Milestone[];
}

export interface ApprovalStep {
  id: number;
  step_no: number;
  name: string;
  actor: string | null;
  status: "Done" | "Pending" | "Waiting";
}

export interface Evidence {
  id: number;
  file_name: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface ApprovalWorkflow {
  milestone_id: number;
  milestone_name: string;
  steps: ApprovalStep[];
  evidence: Evidence[];
}
