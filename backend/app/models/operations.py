from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Dependency(Base):
    __tablename__ = "Dependencies"

    id: Mapped[int] = mapped_column("DependencyId", primary_key=True)
    project_id: Mapped[int | None] = mapped_column("ProjectId", Integer)
    predecessor_id: Mapped[int | None] = mapped_column("PredecessorMilestoneId", Integer)
    successor_id: Mapped[int | None] = mapped_column("SuccessorMilestoneId", Integer)


class Risk(Base):
    __tablename__ = "Risks"

    id: Mapped[int] = mapped_column("RiskId", primary_key=True)
    project_id: Mapped[int | None] = mapped_column("ProjectId", Integer)
    description: Mapped[str | None] = mapped_column("RiskDescription", String(500))
    impact: Mapped[str | None] = mapped_column("Impact", String(50))
    probability: Mapped[str | None] = mapped_column("Probability", String(50))
    owner: Mapped[str | None] = mapped_column("Owner", String(100))
    title: Mapped[str | None] = mapped_column("Title", String(200))
    risk_type: Mapped[str] = mapped_column("RiskType", String(20), default="Risk", server_default=text("'Risk'"))
    status: Mapped[str] = mapped_column("Status", String(20), default="Open", server_default=text("'Open'"))
    due_date: Mapped[date | None] = mapped_column("DueDate", Date)
    mitigation: Mapped[str | None] = mapped_column("Mitigation", String(1000))
    milestone_id: Mapped[int | None] = mapped_column("MilestoneId", Integer)
    created_at: Mapped[datetime] = mapped_column("CreatedAt", DateTime, default=_utcnow)


class Action(Base):
    __tablename__ = "Actions"

    id: Mapped[int] = mapped_column("ActionId", primary_key=True)
    project_id: Mapped[int | None] = mapped_column("ProjectId", Integer)
    description: Mapped[str | None] = mapped_column("Description", String(500))
    owner: Mapped[str | None] = mapped_column("Owner", String(100))
    due_date: Mapped[date | None] = mapped_column("DueDate", Date)
    status: Mapped[str | None] = mapped_column("Status", String(50))
    escalation_level: Mapped[int | None] = mapped_column("EscalationLevel", Integer)
    title: Mapped[str | None] = mapped_column("Title", String(200))
    priority: Mapped[str] = mapped_column("Priority", String(20), default="Medium", server_default=text("'Medium'"))
    action_type: Mapped[str] = mapped_column("ActionType", String(20), default="Task", server_default=text("'Task'"))
    run_by: Mapped[str] = mapped_column("RunBy", String(20), default="Manual", server_default=text("'Manual'"))
    approval_status: Mapped[str] = mapped_column(
        "ApprovalStatus", String(20), default="None", server_default=text("'None'")
    )
    milestone_id: Mapped[int | None] = mapped_column("MilestoneId", Integer)
    created_at: Mapped[datetime] = mapped_column("CreatedAt", DateTime, default=_utcnow)
    completed_at: Mapped[datetime | None] = mapped_column("CompletedAt", DateTime)


class GovernanceRule(Base):
    __tablename__ = "GovernanceRules"

    id: Mapped[int] = mapped_column("RuleId", primary_key=True)
    code: Mapped[str | None] = mapped_column("RuleCode", String(50))
    name: Mapped[str | None] = mapped_column("RuleName", String(300))
    category: Mapped[str | None] = mapped_column("RuleCategory", String(100))
    severity: Mapped[str | None] = mapped_column("Severity", String(50))
    condition_json: Mapped[str | None] = mapped_column("ConditionJson", Text)
    action_json: Mapped[str | None] = mapped_column("ActionJson", Text)
    is_active: Mapped[bool] = mapped_column("IsActive", Boolean, default=True, server_default=text("1"))


class AppSetting(Base):
    __tablename__ = "AppSettings"

    key: Mapped[str] = mapped_column("SettingKey", String(100), primary_key=True)
    value: Mapped[str] = mapped_column("SettingValue", String(1000))
    updated_by: Mapped[str | None] = mapped_column("UpdatedBy", String(100))
    updated_at: Mapped[datetime] = mapped_column("UpdatedAt", DateTime, default=_utcnow)


class SavedReport(Base):
    __tablename__ = "SavedReports"

    id: Mapped[int] = mapped_column("ReportId", primary_key=True)
    title: Mapped[str] = mapped_column("Title", String(200))
    report_type: Mapped[str] = mapped_column("ReportType", String(50))
    project_id: Mapped[int | None] = mapped_column("ProjectId", Integer)
    period: Mapped[str | None] = mapped_column("Period", String(20))
    created_by: Mapped[str] = mapped_column("CreatedBy", String(100))
    created_at: Mapped[datetime] = mapped_column("CreatedAt", DateTime, default=_utcnow)


class ReportSchedule(Base):
    __tablename__ = "ReportSchedules"

    id: Mapped[int] = mapped_column("ScheduleId", primary_key=True)
    name: Mapped[str] = mapped_column("Name", String(200))
    report_type: Mapped[str] = mapped_column("ReportType", String(50))
    frequency: Mapped[str] = mapped_column("Frequency", String(20))
    format: Mapped[str] = mapped_column("Format", String(10))
    is_active: Mapped[bool] = mapped_column("IsActive", Boolean, default=True, server_default=text("1"))
    created_by: Mapped[str] = mapped_column("CreatedBy", String(100))
    created_at: Mapped[datetime] = mapped_column("CreatedAt", DateTime, default=_utcnow)
