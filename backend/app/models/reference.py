from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ProjectType(Base):
    __tablename__ = "ProjectTypes"

    id: Mapped[int] = mapped_column("ProjectTypeId", primary_key=True)
    name: Mapped[str] = mapped_column("TypeName", String(100), unique=True)
    is_active: Mapped[bool] = mapped_column("IsActive", Boolean, default=True, server_default=text("1"))


class ProjectStatus(Base):
    __tablename__ = "ProjectStatuses"

    id: Mapped[int] = mapped_column("StatusId", primary_key=True)
    name: Mapped[str | None] = mapped_column("StatusName", String(50))


class ActionStatus(Base):
    __tablename__ = "ActionStatuses"

    id: Mapped[int] = mapped_column("StatusId", primary_key=True)
    name: Mapped[str | None] = mapped_column("StatusName", String(50))


class RiskLevel(Base):
    __tablename__ = "RiskLevels"

    id: Mapped[int] = mapped_column("RiskLevelId", primary_key=True)
    name: Mapped[str | None] = mapped_column("RiskLevel", String(50))
    score_from: Mapped[int | None] = mapped_column("RiskScoreFrom", Integer)


class ProcessTemplate(Base):
    __tablename__ = "ProcessTemplates"

    id: Mapped[int] = mapped_column("TemplateId", primary_key=True)
    name: Mapped[str | None] = mapped_column("TemplateName", String(200))
    description: Mapped[str | None] = mapped_column("Description", Text)


class ProcessStage(Base):
    __tablename__ = "ProcessStages"

    id: Mapped[int] = mapped_column("StageId", primary_key=True)
    template_id: Mapped[int | None] = mapped_column("TemplateId", ForeignKey("ProcessTemplates.TemplateId"))
    name: Mapped[str | None] = mapped_column("StageName", String(200))
    sequence: Mapped[int | None] = mapped_column("SequenceNo", Integer)
