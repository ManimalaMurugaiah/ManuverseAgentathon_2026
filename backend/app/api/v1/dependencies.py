from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.operations import Dependency
from app.models.project import Milestone
from app.models.user import User
from app.schemas.operations import DependencyCreate, DependencyGraph, SimulationRequest, SimulationResult
from app.services.dependency_service import build_graph, project_edges, simulate_delay, would_create_cycle
from app.services.project_service import MILESTONE_NOT_FOUND, PROJECT_NOT_FOUND, get_project_or_404

router = APIRouter(prefix="/projects/{project_id}/dependencies", tags=["dependencies"])

READ_ROLES = ("admin", "manager", "engineering", "approver", "viewer")
WRITE_ROLES = ("admin", "manager", "engineering")
NOT_FOUND = {404: {"description": f"{PROJECT_NOT_FOUND} or {MILESTONE_NOT_FOUND}"}}


@router.get("", responses=NOT_FOUND)
def get_graph(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*READ_ROLES))],
) -> DependencyGraph:
    return build_graph(db, get_project_or_404(db, project_id))


@router.post(
    "",
    status_code=201,
    responses={**NOT_FOUND, 400: {"description": "Invalid link"}, 409: {"description": "Link already exists"}},
)
def add_dependency(
    project_id: int,
    payload: DependencyCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*WRITE_ROLES))],
) -> DependencyGraph:
    project = get_project_or_404(db, project_id)
    if payload.predecessor_id == payload.successor_id:
        raise HTTPException(status_code=400, detail="A milestone cannot depend on itself")

    ids = {payload.predecessor_id, payload.successor_id}
    owned = {mid for (mid,) in db.query(Milestone.id).filter(Milestone.project_id == project_id, Milestone.id.in_(ids))}
    if owned != ids:
        raise HTTPException(status_code=400, detail="Both milestones must belong to this project")

    all_ids = {mid for (mid,) in db.query(Milestone.id).filter(Milestone.project_id == project_id)}
    edges = project_edges(db, project_id, all_ids)
    if any(e.predecessor_id == payload.predecessor_id and e.successor_id == payload.successor_id for e in edges):
        raise HTTPException(status_code=409, detail="This dependency already exists")
    if would_create_cycle(edges, payload.predecessor_id, payload.successor_id):
        raise HTTPException(status_code=400, detail="This link would create a circular dependency")

    db.add(Dependency(project_id=project_id, predecessor_id=payload.predecessor_id, successor_id=payload.successor_id))
    db.commit()
    return build_graph(db, project)


@router.delete("/{dependency_id}", responses=NOT_FOUND)
def remove_dependency(
    project_id: int,
    dependency_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*WRITE_ROLES))],
) -> DependencyGraph:
    project = get_project_or_404(db, project_id)
    edge = db.get(Dependency, dependency_id)
    if not edge or edge.project_id != project_id:
        raise HTTPException(status_code=404, detail="Dependency not found")
    db.delete(edge)
    db.commit()
    return build_graph(db, project)


@router.post("/simulate", responses=NOT_FOUND)
def simulate(
    project_id: int,
    payload: SimulationRequest,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*READ_ROLES))],
) -> SimulationResult:
    result = simulate_delay(db, get_project_or_404(db, project_id), payload.milestone_id, payload.delay_days)
    if result is None:
        raise HTTPException(status_code=404, detail=MILESTONE_NOT_FOUND)
    return result
