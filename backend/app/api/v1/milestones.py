from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.project import Milestone
from app.models.user import User
from app.schemas.project import (
    ApprovalWorkflowOut,
    EvidenceCreate,
    MilestoneCreate,
    MilestoneList,
    MilestoneOut,
    MilestoneStatus,
    MilestoneUpdate,
)
from app.services.project_service import (
    MILESTONE_NOT_FOUND,
    NOT_STARTED,
    PROJECT_NOT_FOUND,
    add_evidence,
    advance_approval,
    get_milestone_or_404,
    get_project_or_404,
    resolve_status_progress,
    to_approval_out,
    to_milestone_out,
)

router = APIRouter(tags=["milestones"])

READ_ROLES = ("admin", "manager", "engineering", "approver", "viewer")
WRITE_ROLES = ("admin", "manager", "engineering")
APPROVAL_ROLES = ("admin", "manager", "engineering", "approver")
NOT_FOUND = {404: {"description": f"{PROJECT_NOT_FOUND} or {MILESTONE_NOT_FOUND}"}}


@router.get("/projects/{project_id}/milestones", responses=NOT_FOUND)
def list_milestones(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*READ_ROLES))],
    status: MilestoneStatus | None = None,
) -> MilestoneList:
    project = get_project_or_404(db, project_id)
    query = db.query(Milestone).filter(Milestone.project_id == project_id)
    if status:
        query = query.filter(Milestone.status == status)
    rows = query.order_by(Milestone.due_date, Milestone.id).all()
    return MilestoneList(
        project_id=project.id,
        project_name=project.name or "Untitled project",
        items=[to_milestone_out(m) for m in rows],
    )


@router.post("/projects/{project_id}/milestones", status_code=201, responses={**NOT_FOUND, 400: {"description": "Inconsistent status and progress"}})
def create_milestone(
    project_id: int,
    payload: MilestoneCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*WRITE_ROLES))],
) -> MilestoneOut:
    get_project_or_404(db, project_id)
    try:
        status, progress = resolve_status_progress(payload.status, payload.progress, "progress" in payload.model_fields_set)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    milestone = Milestone(
        project_id=project_id,
        name=payload.name.strip(),
        owner=payload.owner.strip(),
        due_date=payload.due_date,
        forecast_date=payload.due_date,
        status=status,
        progress=progress,
        critical=payload.critical,
    )
    if status == "Completed":
        milestone.actual_date = date.today()
    db.add(milestone)
    db.commit()
    db.refresh(milestone)
    return to_milestone_out(milestone)


@router.patch("/milestones/{milestone_id}", responses={**NOT_FOUND, 400: {"description": "Inconsistent status and progress"}})
def update_milestone(
    milestone_id: int,
    payload: MilestoneUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*WRITE_ROLES))],
) -> MilestoneOut:
    milestone = get_milestone_or_404(db, milestone_id)
    data = payload.model_dump(exclude_unset=True)

    status = data.get("status") or milestone.status or NOT_STARTED
    progress = data["progress"] if data.get("progress") is not None else milestone.progress
    progress_given = data.get("progress") is not None
    if not data.get("status") and progress_given:
        if progress == 100:
            status = "Completed"
        elif progress > 0 and status == NOT_STARTED:
            status = "In Progress"

    try:
        status, progress = resolve_status_progress(status, progress, progress_given)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    for field in ("name", "owner", "due_date", "forecast_date", "critical"):
        if data.get(field) is not None:
            setattr(milestone, field, data[field])
    milestone.status = status
    milestone.progress = progress
    milestone.actual_date = (milestone.actual_date or date.today()) if status == "Completed" else None

    db.commit()
    db.refresh(milestone)
    return to_milestone_out(milestone)


@router.get("/milestones/{milestone_id}/approvals", responses=NOT_FOUND)
def get_approvals(
    milestone_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*READ_ROLES))],
) -> ApprovalWorkflowOut:
    return to_approval_out(db, get_milestone_or_404(db, milestone_id))


@router.post(
    "/milestones/{milestone_id}/approvals/advance",
    responses={**NOT_FOUND, 403: {"description": "Role cannot approve this step"}, 409: {"description": "No pending step"}},
)
def advance_approval_step(
    milestone_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(*APPROVAL_ROLES))],
) -> ApprovalWorkflowOut:
    milestone = get_milestone_or_404(db, milestone_id)
    advance_approval(db, milestone, user)
    return to_approval_out(db, milestone)


@router.post(
    "/milestones/{milestone_id}/evidence",
    status_code=201,
    responses={**NOT_FOUND, 409: {"description": "Duplicate evidence"}},
)
def register_evidence(
    milestone_id: int,
    payload: EvidenceCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(*WRITE_ROLES))],
) -> ApprovalWorkflowOut:
    milestone = get_milestone_or_404(db, milestone_id)
    add_evidence(db, milestone, payload.file_name, user)
    return to_approval_out(db, milestone)
