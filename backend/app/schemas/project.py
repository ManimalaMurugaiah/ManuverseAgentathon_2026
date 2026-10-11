from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

MilestoneStatus = Literal["Not Started", "In Progress", "Completed", "Delayed", "At Risk"]
ProjectLifecycle = Literal["Draft", "Planning", "Execution", "On Hold", "Completed", "Cancelled"]
ScheduleStatus = Literal["On track", "At risk", "Delayed", "Completed"]
HealthRating = Literal["Good", "Watch", "Poor"]
RiskLevelName = Literal["Low", "Medium", "High", "Critical"]

CODE_PATTERN = r"^[A-Za-z0-9_-]+$"
EVIDENCE_PATTERN = r"(?i)^[a-z0-9][a-z0-9 _.\-]{0,150}\.(pdf|png|jpe?g|zip|docx?|xlsx?|txt)$"


class Trimmed(BaseModel):
    """Strips whitespace and treats blank strings as missing so optional fields stay NULL."""

    model_config = ConfigDict(str_strip_whitespace=True)

    @model_validator(mode="before")
    @classmethod
    def _blank_to_none(cls, data: object) -> object:
        if isinstance(data, dict):
            return {k: (None if isinstance(v, str) and not v.strip() else v) for k, v in data.items()}
        return data


def _check_project_rules(start: date | None, end: date | None, budget: Decimal | None, spent: Decimal | None) -> None:
    if start and end and end < start:
        raise ValueError("end_date must not be before start_date")
    if budget is not None and spent is not None and spent > budget:
        raise ValueError("budget_spent must not exceed budget")


class ProjectCreate(Trimmed):
    name: str = Field(min_length=2, max_length=200)
    code: str | None = Field(default=None, min_length=2, max_length=50, pattern=CODE_PATTERN)
    project_type: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    business_objective: str | None = Field(default=None, max_length=500)
    scope: str | None = Field(default=None, max_length=1000)
    plant: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=100)
    business: str | None = Field(default=None, max_length=150)
    sponsor: str | None = Field(default=None, max_length=100)
    owner: str = Field(min_length=1, max_length=100)
    budget: Decimal | None = Field(default=None, ge=0, max_digits=18, decimal_places=2)
    budget_spent: Decimal = Field(default=Decimal(0), ge=0, max_digits=18, decimal_places=2)
    resources: str | None = Field(default=None, max_length=500)
    start_date: date
    end_date: date
    status: ProjectLifecycle = "Planning"
    health: HealthRating = "Good"
    risk_level: RiskLevelName | None = None
    ai_agents_enabled: bool = True
    template_id: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def _check_rules(self) -> "ProjectCreate":
        _check_project_rules(self.start_date, self.end_date, self.budget, self.budget_spent)
        return self


class ProjectUpdate(Trimmed):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    project_type: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    business_objective: str | None = Field(default=None, max_length=500)
    scope: str | None = Field(default=None, max_length=1000)
    plant: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=100)
    business: str | None = Field(default=None, max_length=150)
    sponsor: str | None = Field(default=None, max_length=100)
    owner: str | None = Field(default=None, min_length=1, max_length=100)
    budget: Decimal | None = Field(default=None, ge=0, max_digits=18, decimal_places=2)
    budget_spent: Decimal | None = Field(default=None, ge=0, max_digits=18, decimal_places=2)
    resources: str | None = Field(default=None, max_length=500)
    start_date: date | None = None
    end_date: date | None = None
    forecast_date: date | None = None
    status: ProjectLifecycle | None = None
    health: HealthRating | None = None
    risk_level: RiskLevelName | None = None
    ai_agents_enabled: bool | None = None

    @model_validator(mode="after")
    def _check_rules(self) -> "ProjectUpdate":
        _check_project_rules(self.start_date, self.end_date, self.budget, self.budget_spent)
        return self


class ProjectOut(BaseModel):
    id: int
    code: str | None
    name: str
    project_type: str | None
    owner: str | None
    business: str | None
    country: str | None
    plant: str | None
    location: str | None
    budget: Decimal | None
    budget_spent: Decimal
    status: str | None
    schedule_status: ScheduleStatus
    health: str
    progress: int
    milestone_count: int
    start_date: date | None
    end_date: date | None
    forecast_date: date | None
    ai_agents_enabled: bool


class ProjectMetrics(BaseModel):
    milestones_total: int
    milestones_completed: int
    milestones_in_progress: int
    milestones_not_started: int
    milestones_delayed: int
    milestones_at_risk: int
    risks_high: int
    risks_medium: int
    risks_low: int
    actions_open: int
    actions_overdue: int
    actions_due_soon: int
    budget_spent_pct: int


class ProjectDetail(ProjectOut):
    description: str | None
    business_objective: str | None
    scope: str | None
    sponsor: str | None
    resources: str | None
    risk_level: str | None
    duration_days: int | None
    metrics: ProjectMetrics


class ProjectSummary(BaseModel):
    total: int
    on_track: int
    at_risk: int
    delayed: int
    completed: int


class ProjectList(BaseModel):
    items: list[ProjectOut]
    total: int
    page: int
    page_size: int
    owners: list[str]
    plants: list[str]
    businesses: list[str]


class MilestoneCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    owner: str = Field(min_length=1, max_length=100)
    due_date: date
    status: MilestoneStatus = "Not Started"
    progress: int = Field(default=0, ge=0, le=100)
    critical: bool = False


class MilestoneUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    owner: str | None = Field(default=None, min_length=1, max_length=100)
    due_date: date | None = None
    forecast_date: date | None = None
    status: MilestoneStatus | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
    critical: bool | None = None


class MilestoneOut(BaseModel):
    id: int
    project_id: int
    name: str
    owner: str | None
    status: str
    progress: int
    due_date: date | None
    forecast_date: date | None
    actual_date: date | None
    critical: bool


class MilestoneList(BaseModel):
    project_id: int
    project_name: str
    items: list[MilestoneOut]


class ApprovalStepOut(BaseModel):
    id: int
    step_no: int
    name: str
    actor: str | None
    status: str


class EvidenceOut(BaseModel):
    id: int
    file_name: str
    uploaded_by: str
    uploaded_at: datetime


class ApprovalWorkflowOut(BaseModel):
    milestone_id: int
    milestone_name: str
    steps: list[ApprovalStepOut]
    evidence: list[EvidenceOut]


class EvidenceCreate(BaseModel):
    file_name: str = Field(max_length=200, pattern=EVIDENCE_PATTERN)
