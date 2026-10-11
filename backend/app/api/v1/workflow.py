from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.user import User
from app.models.workflow import WorkflowRun
from app.schemas.workflow import WorkflowRunCreate, WorkflowRunResponse, WorkflowStepRequest
from app.services.workflow.orchestrator import orchestrator

router = APIRouter(prefix="/workflow", tags=["workflow"])


@router.get("/runs")
def list_runs(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager", "viewer", "engineering", "approver"))],
    limit: int = Query(default=20, ge=1, le=100),
    project_code: str | None = Query(default=None, min_length=1, max_length=64),
) -> list[WorkflowRunResponse]:
    query = db.query(WorkflowRun)
    if project_code:
        query = query.filter(WorkflowRun.project_code == project_code)
    runs = query.order_by(WorkflowRun.updated_at.desc(), WorkflowRun.id.desc()).limit(limit).all()
    return [WorkflowRunResponse.model_validate(run, from_attributes=True) for run in runs]


@router.get("/projects")
def list_projects(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager", "viewer", "engineering", "approver"))],
) -> list[str]:
    return [
        project_code
        for (project_code,) in db.query(WorkflowRun.project_code).distinct().order_by(WorkflowRun.project_code).all()
    ]


@router.post("/runs")
async def start_run(
    payload: WorkflowRunCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager", "engineering"))],
) -> WorkflowRunResponse:
    run = await orchestrator.start_run(db, payload.project_code)
    return WorkflowRunResponse.model_validate(run, from_attributes=True)


@router.post("/step", responses={404: {"description": "Run not found"}})
async def step_run(
    payload: WorkflowStepRequest,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager", "approver"))],
) -> WorkflowRunResponse:
    run = db.query(WorkflowRun).filter(WorkflowRun.id == payload.run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    updated = await orchestrator.step(db, run, payload.approved, payload.note)
    return WorkflowRunResponse.model_validate(updated, from_attributes=True)


@router.get("/runs/{run_id}", responses={404: {"description": "Run not found"}})
def get_run(
    run_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager", "viewer", "engineering", "approver"))],
) -> WorkflowRunResponse:
    run = db.query(WorkflowRun).filter(WorkflowRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    return WorkflowRunResponse.model_validate(run, from_attributes=True)


@router.get("/runs/{run_id}/logs")
def get_logs(
    run_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager", "viewer", "engineering", "approver"))],
) -> list[dict[str, str]]:
    logs = orchestrator.list_logs(db, run_id)
    return [
        {
            "agent_name": log.agent_name,
            "action": log.action,
            "status": log.status,
            "details": log.details,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]
