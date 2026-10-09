from typing import Annotated
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.user import User
from app.models.workflow import WorkflowRun
from app.schemas.workflow import WorkflowAutoRequest, WorkflowAutoResponse, WorkflowRunCreate, WorkflowRunResponse, WorkflowStepRequest
from app.services.workflow.orchestrator import orchestrator

router = APIRouter(prefix="/workflow", tags=["workflow"])
ACCESS_DENIED = "Access denied"
RUN_NOT_FOUND = "Run not found"

_run_owner: dict[int, str] = {}
_owner_lock = Lock()


def _track_owner(run_id: int, username: str) -> None:
    with _owner_lock:
        _run_owner[run_id] = username


def _can_access_run(user: User, run_id: int) -> bool:
    if user.role in {"admin", "manager", "viewer"}:
        return True
    with _owner_lock:
        owner = _run_owner.get(run_id)
    return owner == user.username


@router.post("/runs")
async def start_run(
    payload: WorkflowRunCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_roles("admin", "manager", "engineering"))],
) -> WorkflowRunResponse:
    run = await orchestrator.start_run(db, payload.project_code)
    _track_owner(run.id, user.username)
    return WorkflowRunResponse.model_validate(run, from_attributes=True)


@router.post("/step", responses={404: {"description": "Run not found"}})
async def step_run(
    payload: WorkflowStepRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_roles("admin", "manager", "approver"))],
) -> WorkflowRunResponse:
    run = db.query(WorkflowRun).filter(WorkflowRun.id == payload.run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail=RUN_NOT_FOUND)
    if not _can_access_run(user, run.id):
        raise HTTPException(status_code=403, detail=ACCESS_DENIED)

    updated = await orchestrator.step(db, run, payload.approved, payload.note)
    return WorkflowRunResponse.model_validate(updated, from_attributes=True)


@router.get("/runs/{run_id}", responses={404: {"description": "Run not found"}})
def get_run(
    run_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_roles("admin", "manager", "viewer", "engineering", "approver"))],
) -> WorkflowRunResponse:
    run = db.query(WorkflowRun).filter(WorkflowRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail=RUN_NOT_FOUND)
    if not _can_access_run(user, run.id):
        raise HTTPException(status_code=403, detail=ACCESS_DENIED)

    return WorkflowRunResponse.model_validate(run, from_attributes=True)


@router.get("/runs/{run_id}/logs")
def get_logs(
    run_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_roles("admin", "manager", "viewer", "engineering", "approver"))],
) -> list[dict[str, str]]:
    if not _can_access_run(user, run_id):
        raise HTTPException(status_code=403, detail=ACCESS_DENIED)
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


@router.post("/auto/process", responses={404: {"description": "Run not found"}})
async def auto_process_runs(
    payload: WorkflowAutoRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_roles("admin", "manager", "engineering", "approver"))],
) -> WorkflowAutoResponse:
    runs: list[WorkflowRun]
    if payload.run_id is not None:
        run = db.query(WorkflowRun).filter(WorkflowRun.id == payload.run_id).first()
        if not run:
            raise HTTPException(status_code=404, detail=RUN_NOT_FOUND)
        if not _can_access_run(user, run.id):
            raise HTTPException(status_code=403, detail=ACCESS_DENIED)
        runs = [run]
    else:
        candidates = db.query(WorkflowRun).filter(WorkflowRun.status == "running").all()
        runs = [r for r in candidates if _can_access_run(user, r.id)]

    updated_runs: list[WorkflowRunResponse] = []
    for run in runs:
        updated = await orchestrator.auto_advance(db, run, max_steps=payload.max_steps, note=payload.note)
        updated_runs.append(WorkflowRunResponse.model_validate(updated, from_attributes=True))

    return WorkflowAutoResponse(processed_runs=len(updated_runs), runs=updated_runs)
