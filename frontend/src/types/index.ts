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
}

export interface DashboardSummary {
  total_runs: number;
  running: number;
  blocked: number;
  completed: number;
}
