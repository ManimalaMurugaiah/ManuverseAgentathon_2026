from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.operations import Risk
from app.models.project import Milestone, Project
from app.models.user import User
from app.schemas.operations import RiskCreate, RiskList, RiskOut, RiskStatus, RiskType, RiskUpdate, Severity
from app.services.project_service import PROJECT_NOT_FOUND
from app.services.register_service import SEVERITY_ORDER, project_map, project_scope, risk_to_out

router = APIRouter(prefix="/risks", tags=["risks"])

READ_ROLES = ("admin", "manager", "engineering", "approver", "viewer")
WRITE_ROLES = ("admin", "manager", "engineering")
RISK_NOT_FOUND = "Risk not found"
NOT_FOUND = {404: {"description": f"{PROJECT_NOT_FOUND} or {RISK_NOT_FOUND}"}}


def _check_milestone(db: Session, project_id: int, milestone_id: int | None) -> None:
    if milestone_id is None:
        return
    milestone = db.get(Milestone, milestone_id)
    if not milestone or milestone.project_id != project_id:
        raise HTTPException(status_code=400, detail="Milestone does not belong to this project")


@router.get("")
def list_risks(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*READ_ROLES))],
    project_id: int | None = None,
    business: Annotated[str | None, Query(max_length=150)] = None,
    risk_type: Annotated[RiskType | None, Query(alias="type")] = None,
    severity: Severity | None = None,
    status: RiskStatus | None = None,
    active_only: bool = False,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
) -> RiskList:
    scope = project_scope(db, project_id, business)
    query = db.query(Risk)
    if scope is not None:
        query = query.filter(Risk.project_id.in_(scope))
    projects = project_map(db)
    in_scope = [risk_to_out(r, projects) for r in query.all()]

    items = [
        r for r in in_scope
        if (not risk_type or r.risk_type == risk_type)
        and (not severity or r.severity == severity)
        and (not status or r.status == status)
        and (not active_only or r.status != "Resolved")
    ]
    items.sort(key=lambda r: (r.status == "Resolved", SEVERITY_ORDER[r.severity], r.due_date is None, r.due_date, -r.id))
    return RiskList(
        items=items[:limit],
        total=len(in_scope),
        open_count=sum(1 for r in in_scope if r.status != "Resolved"),
    )


@router.post("", status_code=201, responses={**NOT_FOUND, 400: {"description": "Milestone not in project"}})
def create_risk(
    payload: RiskCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*WRITE_ROLES))],
) -> RiskOut:
    if not db.get(Project, payload.project_id):
        raise HTTPException(status_code=404, detail=PROJECT_NOT_FOUND)
    _check_milestone(db, payload.project_id, payload.milestone_id)

    risk = Risk(
        project_id=payload.project_id,
        title=payload.title,
        description=payload.description or payload.title,
        risk_type=payload.risk_type,
        impact=payload.impact,
        probability=payload.likelihood,
        owner=payload.owner,
        due_date=payload.due_date,
        mitigation=payload.mitigation,
        milestone_id=payload.milestone_id,
        status=payload.status,
    )
    db.add(risk)
    db.commit()
    db.refresh(risk)
    return risk_to_out(risk, project_map(db))


@router.patch("/{risk_id}", responses=NOT_FOUND)
def update_risk(
    risk_id: int,
    payload: RiskUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*WRITE_ROLES))],
) -> RiskOut:
    risk = db.get(Risk, risk_id)
    if not risk:
        raise HTTPException(status_code=404, detail=RISK_NOT_FOUND)

    attrs = {"likelihood": "probability"}
    required = {"title", "risk_type", "impact", "likelihood", "owner", "status"}
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is None and field in required:
            continue
        setattr(risk, attrs.get(field, field), value)
    db.commit()
    db.refresh(risk)
    return risk_to_out(risk, project_map(db))


@router.delete("/{risk_id}", status_code=204, responses=NOT_FOUND)
def delete_risk(
    risk_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager"))],
) -> None:
    risk = db.get(Risk, risk_id)
    if not risk:
        raise HTTPException(status_code=404, detail=RISK_NOT_FOUND)
    db.delete(risk)
    db.commit()
