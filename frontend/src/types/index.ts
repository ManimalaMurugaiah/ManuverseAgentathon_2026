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

export type ScheduleStatus = "On track" | "At risk" | "Delayed" | "Completed";
export type ProjectHealth = ScheduleStatus;
export type HealthRating = "Good" | "Watch" | "Poor";
export type Lifecycle = "Draft" | "Planning" | "Execution" | "On Hold" | "Completed" | "Cancelled";
export type MilestoneStatus = "Not Started" | "In Progress" | "Completed" | "Delayed" | "At Risk";

export interface Project {
  id: number;
  code: string | null;
  name: string;
  project_type: string | null;
  owner: string | null;
  business: string | null;
  country: string | null;
  plant: string | null;
  location: string | null;
  budget: string | null;
  budget_spent: string;
  status: string | null;
  schedule_status: ScheduleStatus;
  health: HealthRating;
  progress: number;
  milestone_count: number;
  start_date: string | null;
  end_date: string | null;
  forecast_date: string | null;
  ai_agents_enabled: boolean;
}

export interface ProjectMetrics {
  milestones_total: number;
  milestones_completed: number;
  milestones_in_progress: number;
  milestones_not_started: number;
  milestones_delayed: number;
  milestones_at_risk: number;
  risks_high: number;
  risks_medium: number;
  risks_low: number;
  actions_open: number;
  actions_overdue: number;
  actions_due_soon: number;
  budget_spent_pct: number;
}

export interface ProjectDetail extends Project {
  description: string | null;
  business_objective: string | null;
  scope: string | null;
  sponsor: string | null;
  resources: string | null;
  risk_level: string | null;
  duration_days: number | null;
  metrics: ProjectMetrics;
}

export interface ProjectSummary {
  total: number;
  on_track: number;
  at_risk: number;
  delayed: number;
  completed: number;
}

export interface ProjectList {
  items: Project[];
  total: number;
  page: number;
  page_size: number;
  owners: string[];
  plants: string[];
  businesses: string[];
}

export interface ProjectInput {
  name: string;
  code?: string | null;
  project_type: string | null;
  description: string | null;
  business_objective: string | null;
  scope: string | null;
  plant: string | null;
  country: string | null;
  business: string | null;
  sponsor: string | null;
  owner: string;
  budget: number | null;
  budget_spent: number;
  resources: string | null;
  start_date: string;
  end_date: string;
  forecast_date?: string | null;
  status: Lifecycle;
  health: HealthRating;
  risk_level: string | null;
  ai_agents_enabled: boolean;
  template_id?: number | null;
}

export interface TemplateOption {
  id: number;
  name: string;
  stage_count: number;
}

export interface Lookups {
  project_types: string[];
  lifecycle_statuses: string[];
  risk_levels: string[];
  action_statuses: string[];
  owners: string[];
  plants: string[];
  countries: string[];
  businesses: string[];
  templates: TemplateOption[];
  roles: string[];
}

export type Severity = "Low" | "Medium" | "High";

export interface Risk {
  id: number;
  project_id: number | null;
  project_name: string | null;
  project_code: string | null;
  business: string | null;
  risk_type: "Risk" | "Issue";
  title: string;
  description: string | null;
  impact: string | null;
  likelihood: string | null;
  severity: Severity;
  status: "Open" | "Monitoring" | "Resolved";
  owner: string | null;
  due_date: string | null;
  mitigation: string | null;
  milestone_id: number | null;
  created_at: string;
}

export interface RiskList {
  items: Risk[];
  total: number;
  open_count: number;
}

export interface Action {
  id: number;
  project_id: number | null;
  project_name: string | null;
  project_code: string | null;
  business: string | null;
  title: string;
  description: string | null;
  owner: string | null;
  due_date: string | null;
  status: string;
  is_overdue: boolean;
  priority: "High" | "Medium" | "Low";
  action_type: "Approval" | "Task";
  run_by: "AI agent" | "Manual";
  approval_status: "None" | "Pending" | "Approved" | "Rejected";
  milestone_id: number | null;
  milestone_name: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ActionList {
  items: Action[];
  total: number;
  completed: number;
  overdue: number;
  awaiting_approval: Action[];
}

export interface GraphNode {
  id: number;
  name: string;
  status: MilestoneStatus;
  progress: number;
  due_date: string | null;
  forecast_date: string | null;
  level: number;
  downstream: number;
  on_critical_path: boolean;
  is_bottleneck: boolean;
}

export interface GraphEdge {
  id: number;
  from_id: number;
  to_id: number;
  on_critical_path: boolean;
}

export interface DependencyGraph {
  project_id: number;
  project_name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  critical_path: number[];
  bottleneck: { milestone_id: number; name: string; status: string; downstream: number; reason: string } | null;
}

export interface SimulationResult {
  delay_days: number;
  source: string;
  impacts: { milestone_id: number; name: string; original_date: string | null; new_date: string | null; shift_days: number }[];
  end_shift_days: number;
  summary: string;
}

export interface OverviewData {
  summary: ProjectSummary;
  milestones: { completed: number; in_progress: number; upcoming: number; delayed: number };
  trend: { label: string; value: number | null }[];
  top_risks: Risk[];
  activity: { id: string; label: string; detail: string; tone: "ok" | "warn" | "alert"; when: string; link: "risks" | "actions" | "milestones" }[];
  priority_actions: Action[];
}

export type ReportTab = "Project Health" | "Milestone Report" | "Risk Report" | "Action Report" | "Dependency Report";
export type ReportInterval = "Day" | "Week" | "Month" | "Year";

export interface ReportData {
  stats: {
    range_label: string;
    start: string;
    end: string;
    on_track: number;
    at_risk: number;
    delayed: number;
    milestones: number;
    trend: { label: string; on_track: number; at_risk: number; delayed: number; total: number }[];
  };
  performance: { id: number; code: string | null; name: string; progress: number; schedule_status: string }[];
  budget: { total: string; spent: string; pct: number };
  milestone_trend: { labels: string[]; planned: number[]; actual: number[] };
  milestones: { milestone: string; planned: string | null; owner: string | null; status: string }[];
  dependencies: { dependency: string; owner: string | null; due: string | null; status: string }[];
  risks: { id: number; title: string; severity: string; status: string; owner: string | null; project: string | null; due_date: string | null }[];
  actions: { id: number; title: string; milestone: string | null; owner: string | null; priority: string; due_date: string | null; status: string }[];
}

export interface SavedReport {
  id: number;
  title: string;
  report_type: string;
  project_id: number | null;
  project_name: string | null;
  period: string | null;
  created_by: string;
  created_at: string;
}

export interface ReportSchedule {
  id: number;
  name: string;
  report_type: string;
  frequency: "Weekly" | "Monthly";
  format: "PDF" | "Excel";
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface AppSettings {
  ai_insights: boolean;
  escalation_notifications: boolean;
  auto_followup_overdue: boolean;
  email_notifications: boolean;
  sms_notifications: boolean;
  daily_summary_email: boolean;
  notify_overdue_milestones: boolean;
  require_high_risk_approval: boolean;
  two_person_approval: boolean;
  require_action_owner: boolean;
  notification_recipients: string[];
  date_format: string;
  default_report_period: string;
  dashboard_refresh: string;
  escalate_after: string;
  reporting_timezone: string;
}

export interface Integration {
  name: string;
  detail: string;
  status: "Connected" | "Enabled" | "Disabled" | "Unavailable";
}

export interface ManagedUser {
  id: number;
  username: string;
  email: string | null;
  role: Role;
  is_active: boolean;
  created_at: string | null;
}

export interface GovernanceRule {
  id: number;
  code: string | null;
  name: string | null;
  category: string | null;
  severity: string | null;
  condition: Record<string, unknown>;
  action: Record<string, unknown>;
  is_active: boolean;
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
