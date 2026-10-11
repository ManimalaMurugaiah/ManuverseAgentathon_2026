from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Project(Base):
    __tablename__ = "Projects"

    id: Mapped[int] = mapped_column("ProjectId", primary_key=True)
    code: Mapped[str | None] = mapped_column("ProjectCode", String(50))
    name: Mapped[str | None] = mapped_column("ProjectName", String(200))
    country: Mapped[str | None] = mapped_column("Country", String(100))
    plant: Mapped[str | None] = mapped_column("Plant", String(100))
    owner: Mapped[str | None] = mapped_column("ProjectManager", String(100))
    status: Mapped[str | None] = mapped_column("Status", String(50))
    budget: Mapped[Decimal | None] = mapped_column("Budget", Numeric(18, 2))
    start_date: Mapped[date | None] = mapped_column("StartDate", Date)
    end_date: Mapped[date | None] = mapped_column("TargetCompletionDate", Date)
    forecast_date: Mapped[date | None] = mapped_column("ForecastCompletionDate", Date)
    risk_level: Mapped[str | None] = mapped_column("RiskLevel", String(50))
    ai_agents_enabled: Mapped[bool] = mapped_column(
        "AiAgentsEnabled", Boolean, default=True, server_default=text("1")
    )
    project_type: Mapped[str | None] = mapped_column("ProjectType", String(100))
    description: Mapped[str | None] = mapped_column("Description", String(1000))
    business_objective: Mapped[str | None] = mapped_column("BusinessObjective", String(1000))
    scope: Mapped[str | None] = mapped_column("Scope", String(1000))
    business: Mapped[str | None] = mapped_column("BusinessName", String(150))
    sponsor: Mapped[str | None] = mapped_column("Sponsor", String(100))
    resources: Mapped[str | None] = mapped_column("Resources", String(500))
    budget_spent: Mapped[Decimal] = mapped_column(
        "BudgetSpent", Numeric(18, 2), default=Decimal(0), server_default=text("0")
    )
    health_rating: Mapped[str] = mapped_column(
        "HealthRating", String(20), default="Good", server_default=text("'Good'")
    )


class Milestone(Base):
    __tablename__ = "Milestones"

    id: Mapped[int] = mapped_column("MilestoneId", primary_key=True)
    project_id: Mapped[int | None] = mapped_column("ProjectId", Integer)
    name: Mapped[str | None] = mapped_column("MilestoneName", String(200))
    owner: Mapped[str | None] = mapped_column("Owner", String(100))
    due_date: Mapped[date | None] = mapped_column("PlannedDate", Date)
    forecast_date: Mapped[date | None] = mapped_column("ForecastDate", Date)
    actual_date: Mapped[date | None] = mapped_column("ActualDate", Date)
    status: Mapped[str | None] = mapped_column("Status", String(50))
    critical: Mapped[bool | None] = mapped_column("CriticalFlag", Boolean)
    progress: Mapped[int] = mapped_column("ProgressPct", Integer, default=0, server_default=text("0"))


class MilestoneApprovalStep(Base):
    __tablename__ = "MilestoneApprovalSteps"
    __table_args__ = (UniqueConstraint("MilestoneId", "StepNo", name="UQ_MilestoneApprovalSteps"),)

    id: Mapped[int] = mapped_column("StepId", primary_key=True)
    milestone_id: Mapped[int] = mapped_column("MilestoneId", ForeignKey("Milestones.MilestoneId"))
    step_no: Mapped[int] = mapped_column("StepNo", Integer)
    name: Mapped[str] = mapped_column("StepName", String(100))
    actor: Mapped[str | None] = mapped_column("Actor", String(100))
    status: Mapped[str] = mapped_column("Status", String(20))


class MilestoneEvidence(Base):
    __tablename__ = "MilestoneEvidence"

    id: Mapped[int] = mapped_column("EvidenceId", primary_key=True)
    milestone_id: Mapped[int] = mapped_column("MilestoneId", ForeignKey("Milestones.MilestoneId"))
    file_name: Mapped[str] = mapped_column("FileName", String(200))
    uploaded_by: Mapped[str] = mapped_column("UploadedBy", String(100))
    uploaded_at: Mapped[datetime] = mapped_column("UploadedAt", DateTime, default=_utcnow)
