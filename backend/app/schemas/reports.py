from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.project import Trimmed

ReportType = Literal["Project Health", "Milestone Report", "Risk Report", "Action Report", "Dependency Report"]
ReportInterval = Literal["Day", "Week", "Month", "Year"]


class ReportTrendBucket(BaseModel):
    label: str
    on_track: int
    at_risk: int
    delayed: int
    total: int


class ReportStats(BaseModel):
    range_label: str
    start: date
    end: date
    on_track: int
    at_risk: int
    delayed: int
    milestones: int
    trend: list[ReportTrendBucket]


class ProjectPerformance(BaseModel):
    id: int
    code: str | None
    name: str
    progress: int
    schedule_status: str


class BudgetOverview(BaseModel):
    total: Decimal
    spent: Decimal
    pct: int


class MilestoneTrend(BaseModel):
    labels: list[str]
    planned: list[int]
    actual: list[int]


class MilestoneRow(BaseModel):
    milestone: str
    planned: date | None
    owner: str | None
    status: str


class DependencyRow(BaseModel):
    dependency: str
    owner: str | None
    due: date | None
    status: str


class RiskRow(BaseModel):
    id: int
    title: str
    severity: str
    status: str
    owner: str | None
    project: str | None
    due_date: date | None


class ActionRow(BaseModel):
    id: int
    title: str
    milestone: str | None
    owner: str | None
    priority: str
    due_date: date | None
    status: str


class ReportData(BaseModel):
    stats: ReportStats
    performance: list[ProjectPerformance]
    budget: BudgetOverview
    milestone_trend: MilestoneTrend
    milestones: list[MilestoneRow]
    dependencies: list[DependencyRow]
    risks: list[RiskRow]
    actions: list[ActionRow]


class SavedReportCreate(Trimmed):
    title: str = Field(min_length=2, max_length=200)
    report_type: ReportType
    project_id: int | None = Field(default=None, ge=1)
    period: Literal["Day", "Week", "Month", "Year"] | None = None


class SavedReportOut(BaseModel):
    id: int
    title: str
    report_type: str
    project_id: int | None
    project_name: str | None
    period: str | None
    created_by: str
    created_at: datetime


class ScheduleCreate(Trimmed):
    name: str = Field(min_length=2, max_length=200)
    report_type: ReportType = "Project Health"
    frequency: Literal["Weekly", "Monthly"] = "Weekly"
    format: Literal["PDF", "Excel"] = "PDF"


class ScheduleUpdate(Trimmed):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    frequency: Literal["Weekly", "Monthly"] | None = None
    format: Literal["PDF", "Excel"] | None = None
    is_active: bool | None = None


class ScheduleOut(BaseModel):
    id: int
    name: str
    report_type: str
    frequency: str
    format: str
    is_active: bool
    created_by: str
    created_at: datetime
