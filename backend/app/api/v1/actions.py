from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.operations import Action
from app.models.project import Milestone, Project
from app.models.user import User
from app.schemas.operations import (
    ActionCreate,
    ActionList,
    ActionOut,
    ActionUpdate,
    ApprovalDecision,
    RunBy,
)
from app.services.ops_service import CLOSED_ACTION_STATUSES
from app.services.project_service import PROJECT_NOT_FOUND
from app.services.register_service import PRIORITY_ORDER, action_to_out, milestone_names, project_map, project_scope

router = APIRouter(prefix="/actions", tags=["actions"])

READ_ROLES = ("admin", "manager", "engineering", "approver", "viewer")
WRITE_ROLES = ("admin", "manager", "engineering", "approver")
APPROVER_ROLES = ("admin", "manager", "approver")
ACTION_NOT_FOUND = "Action not found"
NOT_FOUND = {404: {"description": f"{PROJECT_NOT_FOUND} or {ACTION_NOT_FOUND}"}}


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _get_action(db: Session, action_id: int) -> Action:
    action = db.get(Action, action_id)
    if not action:
        raise HTTPException(status_code=404, detail=ACTION_NOT_FOUND)
    return action


def _render(db: Session, action: Action) -> ActionOut:
    return action_to_out(action, project_map(db), milestone_names(db), date.today())


@router.get("")
def list_actions(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(*READ_ROLES))],
    project_id: int | None = None,
    business: Annotated[str | None, Query(max_length=150)] = None,
    status: Annotated[str | None, Query(max_length=50)] = None,
    run_by: RunBy | None = None,
    mine: bool = False,
) -> ActionList:
    scope = project_scope(db, project_id, business)
    query = db.query(Action)
    if scope is not None:
        query = query.filter(Action.project_id.in_(scope))

    today = date.today()
    projects, milestones = project_map(db), milestone_names(db)
    in_scope = [action_to_out(a, projects, milestones, today) for a in query.all()]

    def matches(item: ActionOut) -> bool:
        if status == "Overdue":
            wanted = item.is_overdue
        else:
            wanted = not status or item.status == status
        owner_ok = not mine or (item.owner or "").lower() == user.username.lower()
        return wanted and owner_ok and (not run_by or item.run_by == run_by)

    items = [a for a in in_scope if matches(a)]
    items.sort(key=lambda a: (a.status in CLOSED_ACTION_STATUSES, a.due_date is None, a.due_date, PRIORITY_ORDER.get(a.priority, 1)))
    return ActionList(
        items=items,
        total=len(in_scope),
        completed=sum(1 for a in in_scope if a.status in CLOSED_ACTION_STATUSES),
        overdue=sum(1 for a in in_scope if a.is_overdue),
        awaiting_approval=[a for a in in_scope if a.run_by == "AI agent" and a.approval_status == "Pending"][:5],
    )


@router.post("", status_code=201, responses={**NOT_FOUND, 400: {"description": "Milestone not in project"}})
def create_action(
    payload: ActionCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*WRITE_ROLES))],
) -> ActionOut:
    if not db.get(Project, payload.project_id):
        raise HTTPException(status_code=404, detail=PROJECT_NOT_FOUND)
    if payload.milestone_id is not None:
        milestone = db.get(Milestone, payload.milestone_id)
        if not milestone or milestone.project_id != payload.project_id:
            raise HTTPException(status_code=400, detail="Milestone does not belong to this project")

    action = Action(
        project_id=payload.project_id,
        title=payload.title,
        description=payload.description,
        owner=payload.owner,
        due_date=payload.due_date,
        status="Open",
        priority=payload.priority,
        action_type=payload.action_type,
        run_by=payload.run_by,
        approval_status="Pending" if payload.run_by == "AI agent" else "None",
        milestone_id=payload.milestone_id,
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return _render(db, action)


@router.patch("/{action_id}", responses=NOT_FOUND)
def update_action(
    action_id: int,
    payload: ActionUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*WRITE_ROLES))],
) -> ActionOut:
    action = _get_action(db, action_id)
    required = {"title", "owner", "due_date", "priority", "action_type", "status"}
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is None and field in required:
            continue
        setattr(action, field, value)
        if field == "status":
            action.completed_at = _now() if value in CLOSED_ACTION_STATUSES else None
    db.commit()
    db.refresh(action)
    return _render(db, action)


@router.post(
    "/{action_id}/approval",
    responses={**NOT_FOUND, 409: {"description": "Action is not awaiting approval"}},
)
def decide_approval(
    action_id: int,
    payload: ApprovalDecision,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*APPROVER_ROLES))],
) -> ActionOut:
    action = _get_action(db, action_id)
    if action.approval_status != "Pending":
        raise HTTPException(status_code=409, detail="This action is not awaiting approval")

    if payload.decision == "approve":
        action.approval_status = "Approved"
        action.status = "In Progress"
    else:
        action.approval_status = "Rejected"
        action.status = "Closed"
        action.completed_at = _now()
    db.commit()
    db.refresh(action)
    return _render(db, action)


@router.delete("/{action_id}", status_code=204, responses=NOT_FOUND)
def delete_action(
    action_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager"))],
) -> None:
    db.delete(_get_action(db, action_id))
    db.commit()
