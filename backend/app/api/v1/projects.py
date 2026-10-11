from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.project import Project
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectHealth, ProjectList, ProjectOut, ProjectUpdate
from app.services.project_service import get_project_or_404, project_stats, to_project_out

router = APIRouter(prefix="/projects", tags=["projects"])

READ_ROLES = ("admin", "manager", "engineering", "approver", "viewer")
WRITE_ROLES = ("admin", "manager")


def _next_code(db: Session) -> str:
    number = (db.query(func.max(Project.id)).scalar() or 0) + 1
    while db.query(Project.id).filter(func.lower(Project.code) == f"prj{number:03d}").first():
        number += 1
    return f"PRJ{number:03d}"


@router.get("")
def list_projects(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*READ_ROLES))],
    search: Annotated[str | None, Query(max_length=100)] = None,
    health: ProjectHealth | None = None,
    owner: Annotated[str | None, Query(max_length=100)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 6,
) -> ProjectList:
    query = db.query(Project)
    if search and search.strip():
        term = search.strip().lower()
        query = query.filter(
            func.lower(Project.name).contains(term, autoescape=True)
            | func.lower(Project.code).contains(term, autoescape=True)
        )
    if owner:
        query = query.filter(Project.owner == owner)

    stats = project_stats(db)
    items = [to_project_out(p, stats) for p in query.order_by(Project.id.desc()).all()]
    if health:
        items = [item for item in items if item.health == health]

    owners = sorted({o for (o,) in db.query(Project.owner).filter(Project.owner.is_not(None)).distinct() if o})
    start = (page - 1) * page_size
    return ProjectList(
        items=items[start : start + page_size],
        total=len(items),
        page=page,
        page_size=page_size,
        owners=owners,
    )


@router.post("", status_code=201, responses={409: {"description": "Project code already exists"}})
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
        name=payload.name.strip(),
        owner=payload.owner.strip(),
        country=payload.country,
        plant=payload.plant,
        budget=payload.budget,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status=payload.status,
        ai_agents_enabled=payload.ai_agents_enabled,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return to_project_out(project, {})


@router.get("/{project_id}", responses={404: {"description": "Project not found"}})
def get_project(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*READ_ROLES))],
) -> ProjectOut:
    return to_project_out(get_project_or_404(db, project_id), project_stats(db))


@router.patch(
    "/{project_id}",
    responses={400: {"description": "End date before start date"}, 404: {"description": "Project not found"}},
)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*WRITE_ROLES))],
) -> ProjectOut:
    project = get_project_or_404(db, project_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is None and field in {"name", "owner", "status", "ai_agents_enabled"}:
            continue
        setattr(project, field, value)

    if project.start_date and project.end_date and project.end_date < project.start_date:
        db.rollback()
        raise HTTPException(status_code=400, detail="End date must not be before start date")

    db.commit()
    db.refresh(project)
    return to_project_out(project, project_stats(db))
