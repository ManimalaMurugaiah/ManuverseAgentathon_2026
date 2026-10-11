from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.project import Project
from app.models.user import User
from app.schemas.project import (
    ProjectCreate,
    ProjectDetail,
    ProjectList,
    ProjectOut,
    ProjectSummary,
    ProjectUpdate,
    ScheduleStatus,
)
from app.services.overview_service import summarize_projects
from app.services.project_service import (
    generate_milestones_from_template,
    get_project_or_404,
    project_stats,
    to_project_detail,
    to_project_out,
)

router = APIRouter(prefix="/projects", tags=["projects"])

READ_ROLES = ("admin", "manager", "engineering", "approver", "viewer")
WRITE_ROLES = ("admin", "manager")

# API field -> Project attribute, for the fields whose names differ.
UPDATE_ATTRS = {"health": "health_rating"}
# Fields that cannot be cleared; an explicit null is ignored instead of erasing them.
REQUIRED_ON_UPDATE = {"name", "owner", "status", "health", "ai_agents_enabled", "budget_spent"}


def _next_code(db: Session) -> str:
    number = (db.query(func.max(Project.id)).scalar() or 0) + 1
    while db.query(Project.id).filter(func.lower(Project.code) == f"prj{number:03d}").first():
        number += 1
    return f"PRJ{number:03d}"


@router.get("/next-code")
def next_code(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*WRITE_ROLES))],
) -> dict[str, str]:
    return {"code": _next_code(db)}


@router.get("/summary")
def project_summary(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*READ_ROLES))],
    business: Annotated[str | None, Query(max_length=150)] = None,
) -> ProjectSummary:
    return summarize_projects(db, business)


@router.get("")
def list_projects(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*READ_ROLES))],
    search: Annotated[str | None, Query(max_length=100)] = None,
    schedule: Annotated[ScheduleStatus | None, Query(alias="schedule_status")] = None,
    owner: Annotated[str | None, Query(max_length=100)] = None,
    plant: Annotated[str | None, Query(max_length=100)] = None,
    business: Annotated[str | None, Query(max_length=150)] = None,
    budget_min: Annotated[Decimal | None, Query(ge=0)] = None,
    budget_max: Annotated[Decimal | None, Query(ge=0)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 10,
) -> ProjectList:
    query = db.query(Project)
    if search and search.strip():
        term = search.strip().lower()
        query = query.filter(
            func.lower(Project.name).contains(term, autoescape=True)
            | func.lower(Project.code).contains(term, autoescape=True)
            | func.lower(Project.owner).contains(term, autoescape=True)
        )
    if owner:
        query = query.filter(Project.owner == owner)
    if plant:
        query = query.filter(Project.plant == plant)
    if business:
        query = query.filter(Project.business == business)
    if budget_min is not None:
        query = query.filter(Project.budget >= budget_min)
    if budget_max is not None:
        query = query.filter(Project.budget <= budget_max)

    stats = project_stats(db)
    items = [to_project_out(p, stats) for p in query.order_by(Project.id.desc()).all()]
    if schedule:
        items = [item for item in items if item.schedule_status == schedule]

    def distinct(column) -> list[str]:
        return sorted({v for (v,) in db.query(column).filter(column.is_not(None)).distinct() if v})

    start = (page - 1) * page_size
    return ProjectList(
        items=items[start : start + page_size],
        total=len(items),
        page=page,
        page_size=page_size,
        owners=distinct(Project.owner),
        plants=distinct(Project.plant),
        businesses=distinct(Project.business),
    )


@router.post("", status_code=201, responses={400: {"description": "Unknown process template"}, 409: {"description": "Project code already exists"}})
def create_project(
    payload: ProjectCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*WRITE_ROLES))],
) -> ProjectOut:
    code = payload.code or _next_code(db)
    if db.query(Project.id).filter(func.lower(Project.code) == code.lower()).first():
        raise HTTPException(status_code=409, detail="Project code already exists")

    project = Project(
        code=code,
        name=payload.name,
        project_type=payload.project_type,
        description=payload.description,
        business_objective=payload.business_objective,
        scope=payload.scope,
        owner=payload.owner,
        sponsor=payload.sponsor,
        business=payload.business,
        country=payload.country,
        plant=payload.plant,
        budget=payload.budget,
        budget_spent=payload.budget_spent,
        resources=payload.resources,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status=payload.status,
        health_rating=payload.health,
        risk_level=payload.risk_level,
        ai_agents_enabled=payload.ai_agents_enabled,
    )
    db.add(project)
    db.flush()
    if payload.template_id:
        generate_milestones_from_template(db, project, payload.template_id)
    db.commit()
    db.refresh(project)
    return to_project_out(project, project_stats(db))


@router.get("/{project_id}", responses={404: {"description": "Project not found"}})
def get_project(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*READ_ROLES))],
) -> ProjectDetail:
    return to_project_detail(db, get_project_or_404(db, project_id))


@router.patch(
    "/{project_id}",
    responses={400: {"description": "Inconsistent dates or budget"}, 404: {"description": "Project not found"}},
)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*WRITE_ROLES))],
) -> ProjectDetail:
    project = get_project_or_404(db, project_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is None and field in REQUIRED_ON_UPDATE:
            continue
        setattr(project, UPDATE_ATTRS.get(field, field), value)

    if project.start_date and project.end_date and project.end_date < project.start_date:
        db.rollback()
        raise HTTPException(status_code=400, detail="End date must not be before start date")
    if project.budget is not None and (project.budget_spent or 0) > project.budget:
        db.rollback()
        raise HTTPException(status_code=400, detail="Budget spent must not exceed the budget")

    db.commit()
    db.refresh(project)
    return to_project_detail(db, project)
