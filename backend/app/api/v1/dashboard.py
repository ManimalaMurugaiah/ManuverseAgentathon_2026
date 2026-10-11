from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.user import User
from app.models.workflow import WorkflowRun
from app.schemas.operations import OverviewOut
from app.services.overview_service import build_overview

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

READ_ROLES = ("admin", "manager", "engineering", "approver", "viewer")


@router.get("/overview")
def overview(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*READ_ROLES))],
    business: Annotated[str | None, Query(max_length=150)] = None,
) -> OverviewOut:
    return build_overview(db, business)


@router.get("/summary")
def summary(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager", "engineering", "approver", "viewer"))],
    project_code: str | None = Query(default=None, min_length=1, max_length=64),
) -> dict[str, int]:
    query = db.query(WorkflowRun)
    if project_code:
        query = query.filter(WorkflowRun.project_code == project_code)

    return {
        "total_runs": query.count(),
        "running": query.filter(WorkflowRun.status == "running").count(),
        "blocked": query.filter(WorkflowRun.status == "blocked").count(),
        "completed": query.filter(WorkflowRun.status == "completed").count(),
    }
