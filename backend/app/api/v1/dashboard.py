from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.user import User
from app.models.workflow import WorkflowRun

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def summary(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager", "viewer"))],
) -> dict[str, int]:
    total = db.query(WorkflowRun).count()
    running = db.query(WorkflowRun).filter(WorkflowRun.status == "running").count()
    blocked = db.query(WorkflowRun).filter(WorkflowRun.status == "blocked").count()
    completed = db.query(WorkflowRun).filter(WorkflowRun.status == "completed").count()

    return {
        "total_runs": total,
        "running": running,
        "blocked": blocked,
        "completed": completed,
    }
