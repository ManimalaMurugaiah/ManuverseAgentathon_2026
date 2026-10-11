from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.project import ProjectSummary, Trimmed

RiskType = Literal["Risk", "Issue"]
RiskStatus = Literal["Open", "Monitoring", "Resolved"]
ImpactLevel = Literal["Low", "Medium", "High", "Critical"]
Likelihood = Literal["Low", "Medium", "High"]
Severity = Literal["Low", "Medium", "High"]
ActionPriority = Literal["High", "Medium", "Low"]
ActionType = Literal["Approval", "Task"]
RunBy = Literal["AI agent", "Manual"]
ActionStatusName = Literal["Open", "Assigned", "In Progress", "Closed", "Verified"]
AppRole = Literal["admin", "manager", "engineering", "approver", "viewer"]


# ---- Risks & issues ----
class RiskCreate(Trimmed):
    project_id: int = Field(ge=1)
    title: str = Field(min_length=2, max_length=200)
    risk_type: RiskType = "Risk"
    description: str | None = Field(default=None, max_length=500)
    impact: ImpactLevel = "Medium"
    likelihood: Likelihood = "Medium"
    owner: str = Field(min_length=1, max_length=100)
    due_date: date | None = None
    mitigation: str | None = Field(default=None, max_length=1000)
    milestone_id: int | None = Field(default=None, ge=1)
    status: RiskStatus = "Open"


class RiskUpdate(Trimmed):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    risk_type: RiskType | None = None
    description: str | None = Field(default=None, max_length=500)
    impact: ImpactLevel | None = None
    likelihood: Likelihood | None = None
    owner: str | None = Field(default=None, min_length=1, max_length=100)
    due_date: date | None = None
    mitigation: str | None = Field(default=None, max_length=1000)
    status: RiskStatus | None = None


class RiskOut(BaseModel):
    id: int
    project_id: int | None
    project_name: str | None
    project_code: str | None
    business: str | None
    risk_type: str
    title: str
    description: str | None
    impact: str | None
    likelihood: str | None
    severity: Severity
    status: str
    owner: str | None
    due_date: date | None
    mitigation: str | None
    milestone_id: int | None
    created_at: datetime


class RiskList(BaseModel):
    items: list[RiskOut]
    total: int
    open_count: int


# ---- Actions ----
class ActionCreate(Trimmed):
    project_id: int = Field(ge=1)
    title: str = Field(min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=500)
    owner: str = Field(min_length=1, max_length=100)
    due_date: date
    priority: ActionPriority = "Medium"
    action_type: ActionType = "Task"
    run_by: RunBy = "Manual"
    milestone_id: int | None = Field(default=None, ge=1)


class ActionUpdate(Trimmed):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=500)
    owner: str | None = Field(default=None, min_length=1, max_length=100)
    due_date: date | None = None
    priority: ActionPriority | None = None
    action_type: ActionType | None = None
    status: ActionStatusName | None = None


class ApprovalDecision(Trimmed):
    decision: Literal["approve", "reject"]


class ActionOut(BaseModel):
    id: int
    project_id: int | None
    project_name: str | None
    project_code: str | None
    business: str | None
    title: str
    description: str | None
    owner: str | None
    due_date: date | None
    status: str
    is_overdue: bool
    priority: str
    action_type: str
    run_by: str
    approval_status: str
    milestone_id: int | None
    milestone_name: str | None
    created_at: datetime
    completed_at: datetime | None


class ActionList(BaseModel):
    items: list[ActionOut]
    total: int
    completed: int
    overdue: int
    awaiting_approval: list[ActionOut]


# ---- Dependencies ----
class DependencyCreate(BaseModel):
    predecessor_id: int = Field(ge=1)
    successor_id: int = Field(ge=1)


class GraphNode(BaseModel):
    id: int
    name: str
    status: str
    progress: int
    due_date: date | None
    forecast_date: date | None
    level: int
    downstream: int
    on_critical_path: bool
    is_bottleneck: bool


class GraphEdge(BaseModel):
    id: int
    from_id: int
    to_id: int
    on_critical_path: bool


class Bottleneck(BaseModel):
    milestone_id: int
    name: str
    status: str
    downstream: int
    reason: str


class DependencyGraph(BaseModel):
    project_id: int
    project_name: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    critical_path: list[int]
    bottleneck: Bottleneck | None


class SimulationRequest(BaseModel):
    milestone_id: int = Field(ge=1)
    delay_days: int = Field(ge=1, le=365)


class SimulationImpact(BaseModel):
    milestone_id: int
    name: str
    original_date: date | None
    new_date: date | None
    shift_days: int


class SimulationResult(BaseModel):
    delay_days: int
    source: str
    impacts: list[SimulationImpact]
    end_shift_days: int
    summary: str


# ---- Lookups ----
class TemplateOption(BaseModel):
    id: int
    name: str
    stage_count: int


class LookupsOut(BaseModel):
    project_types: list[str]
    lifecycle_statuses: list[str]
    risk_levels: list[str]
    action_statuses: list[str]
    owners: list[str]
    plants: list[str]
    countries: list[str]
    businesses: list[str]
    templates: list[TemplateOption]
    roles: list[str]


# ---- Overview ----
class MilestoneBreakdown(BaseModel):
    completed: int
    in_progress: int
    upcoming: int
    delayed: int


class TrendPoint(BaseModel):
    label: str
    value: int | None


class ActivityItem(BaseModel):
    id: str
    label: str
    detail: str
    tone: Literal["ok", "warn", "alert"]
    when: datetime
    link: Literal["risks", "actions", "milestones"]


class OverviewOut(BaseModel):
    summary: ProjectSummary
    milestones: MilestoneBreakdown
    trend: list[TrendPoint]
    top_risks: list[RiskOut]
    activity: list[ActivityItem]
    priority_actions: list[ActionOut]


# ---- Settings ----
class SettingsOut(BaseModel):
    ai_insights: bool = True
    escalation_notifications: bool = True
    auto_followup_overdue: bool = True
    email_notifications: bool = True
    sms_notifications: bool = False
    daily_summary_email: bool = False
    notify_overdue_milestones: bool = True
    require_high_risk_approval: bool = True
    two_person_approval: bool = False
    require_action_owner: bool = True
    notification_recipients: list[str] = Field(default_factory=lambda: ["Project Manager", "Engineering Lead"])
    date_format: Literal["DD MMM YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] = "DD MMM YYYY"
    default_report_period: Literal["Daily", "Weekly", "Monthly", "Yearly"] = "Weekly"
    dashboard_refresh: Literal["Manual", "Every 5 minutes", "Every 15 minutes"] = "Manual"
    escalate_after: Literal["1 day", "2 days", "3 days", "1 week"] = "2 days"
    reporting_timezone: Literal["Asia/Kolkata", "UTC", "America/Chicago", "Europe/London"] = "Asia/Kolkata"


class SettingsUpdate(BaseModel):
    model_config = {"extra": "forbid"}

    ai_insights: bool | None = None
    escalation_notifications: bool | None = None
    auto_followup_overdue: bool | None = None
    email_notifications: bool | None = None
    sms_notifications: bool | None = None
    daily_summary_email: bool | None = None
    notify_overdue_milestones: bool | None = None
    require_high_risk_approval: bool | None = None
    two_person_approval: bool | None = None
    require_action_owner: bool | None = None
    notification_recipients: list[str] | None = Field(default=None, max_length=20)
    date_format: Literal["DD MMM YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] | None = None
    default_report_period: Literal["Daily", "Weekly", "Monthly", "Yearly"] | None = None
    dashboard_refresh: Literal["Manual", "Every 5 minutes", "Every 15 minutes"] | None = None
    escalate_after: Literal["1 day", "2 days", "3 days", "1 week"] | None = None
    reporting_timezone: Literal["Asia/Kolkata", "UTC", "America/Chicago", "Europe/London"] | None = None

    @field_validator("notification_recipients")
    @classmethod
    def _clean_recipients(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        cleaned = list(dict.fromkeys(v.strip() for v in value if v.strip()))
        if any(len(v) > 100 for v in cleaned):
            raise ValueError("Recipient names must be 100 characters or fewer")
        return cleaned


class IntegrationOut(BaseModel):
    name: str
    detail: str
    status: Literal["Connected", "Enabled", "Disabled", "Unavailable"]


# ---- Users ----
class UserOut(BaseModel):
    id: int
    username: str
    email: str | None
    role: str
    is_active: bool
    created_at: datetime | None


class UserCreate(Trimmed):
    username: str = Field(min_length=3, max_length=100, pattern=r"^[A-Za-z0-9._-]+$")
    email: str | None = Field(default=None, max_length=200, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    role: AppRole = "viewer"
    password: str = Field(min_length=8, max_length=128)


class UserUpdate(Trimmed):
    email: str | None = Field(default=None, max_length=200, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    role: AppRole | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)


# ---- Governance rules ----
class GovernanceRuleOut(BaseModel):
    id: int
    code: str | None
    name: str | None
    category: str | None
    severity: str | None
    condition: dict
    action: dict
    is_active: bool


class GovernanceRuleUpdate(BaseModel):
    is_active: bool
