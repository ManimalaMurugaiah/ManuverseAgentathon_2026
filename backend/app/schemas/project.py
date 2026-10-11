from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator

MilestoneStatus = Literal["Not Started", "In Progress", "Completed", "Delayed", "At Risk"]
ProjectLifecycle = Literal["Draft", "Planning", "Execution", "On Hold", "Completed", "Cancelled"]
ProjectHealth = Literal["On track", "At risk", "Delayed"]

CODE_PATTERN = r"^[A-Za-z0-9_-]+$"
EVIDENCE_PATTERN = r"(?i)^[a-z0-9][a-z0-9 _.\-]{0,150}\.(pdf|png|jpe?g|zip|docx?|xlsx?|txt)$"


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    code: str | None = Field(default=None, min_length=2, max_length=50, pattern=CODE_PATTERN)
    owner: str = Field(min_length=1, max_length=100)
    country: str | None = Field(default=None, max_length=100)
    plant: str | None = Field(default=None, max_length=100)
    budget: Decimal | None = Field(default=None, ge=0, max_digits=18, decimal_places=2)
    start_date: date
    end_date: date
    status: ProjectLifecycle = "Planning"
    ai_agents_enabled: bool = True

    @model_validator(mode="after")
    def _check_dates(self) -> "ProjectCreate":
        if self.end_date < self.start_date:
            raise ValueError("end_date must not be before start_date")
        return self


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    owner: str | None = Field(default=None, min_length=1, max_length=100)
    country: str | None = Field(default=None, max_length=100)
    plant: str | None = Field(default=None, max_length=100)
    budget: Decimal | None = Field(default=None, ge=0, max_digits=18, decimal_places=2)
    start_date: date | None = None
    end_date: date | None = None
    status: ProjectLifecycle | None = None
    ai_agents_enabled: bool | None = None


class ProjectOut(BaseModel):
    id: int
    code: str | None
    name: str
    owner: str | None
    country: str | None
    plant: str | None
    budget: Decimal | None
    status: str | None
    health: ProjectHealth
    progress: int
    milestone_count: int
    start_date: date | None
    end_date: date | None
    ai_agents_enabled: bool


class ProjectList(BaseModel):
    items: list[ProjectOut]
    total: int
    page: int
    page_size: int
    owners: list[str]


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
