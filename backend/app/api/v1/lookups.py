from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, true
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.project import Project
from app.models.reference import ActionStatus, ProcessStage, ProcessTemplate, ProjectStatus, ProjectType, RiskLevel
from app.models.user import User
from app.schemas.operations import LookupsOut, TemplateOption

router = APIRouter(prefix="/lookups", tags=["lookups"])

ROLES = ["admin", "manager", "engineering", "approver", "viewer"]
# Fallbacks keep forms usable on a database that has not been seeded.
DEFAULT_LIFECYCLE = ["Draft", "Planning", "Execution", "On Hold", "Completed", "Cancelled"]
DEFAULT_RISK_LEVELS = ["Low", "Medium", "High", "Critical"]


def _names(db: Session, column, *order) -> list[str]:
    return [n for (n,) in db.query(column).order_by(*order) if n]


def _distinct(db: Session, column) -> list[str]:
    return sorted({v for (v,) in db.query(column).filter(column.is_not(None)).distinct() if v})


@router.get("")
def get_lookups(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager", "engineering", "approver", "viewer"))],
) -> LookupsOut:
    stage_counts = dict(db.query(ProcessStage.template_id, func.count(ProcessStage.id)).group_by(ProcessStage.template_id))
    templates = [
        TemplateOption(id=t.id, name=t.name or f"Template {t.id}", stage_count=stage_counts.get(t.id, 0))
        for t in db.query(ProcessTemplate).order_by(ProcessTemplate.id)
    ]
    users = [n for (n,) in db.query(User.username).filter(or_(User.is_active.is_(None), User.is_active == true()))]
    return LookupsOut(
        project_types=[n for (n,) in db.query(ProjectType.name).filter(ProjectType.is_active == true()).order_by(ProjectType.name)],
        lifecycle_statuses=_names(db, ProjectStatus.name, ProjectStatus.id) or DEFAULT_LIFECYCLE,
        risk_levels=_names(db, RiskLevel.name, RiskLevel.score_from) or DEFAULT_RISK_LEVELS,
        action_statuses=_names(db, ActionStatus.name, ActionStatus.id),
        owners=sorted({*_distinct(db, Project.owner), *users}),
        plants=_distinct(db, Project.plant),
        countries=_distinct(db, Project.country),
        businesses=_distinct(db, Project.business),
        templates=templates,
        roles=ROLES,
    )
