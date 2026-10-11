from datetime import date

from sqlalchemy.orm import Session

from app.models.operations import Action, Risk
from app.models.project import Milestone, Project
from app.schemas.operations import ActionOut, RiskOut
from app.services.ops_service import is_action_overdue, risk_severity

SEVERITY_ORDER = {"High": 0, "Medium": 1, "Low": 2}
PRIORITY_ORDER = {"High": 0, "Medium": 1, "Low": 2}


def project_scope(db: Session, project_id: int | None, business: str | None) -> set[int] | None:
    """Project ids matching the filters, or None when nothing narrows the scope."""
    if project_id is None and not business:
        return None
    query = db.query(Project.id)
    if project_id is not None:
        query = query.filter(Project.id == project_id)
    if business:
        query = query.filter(Project.business == business)
    return {pid for (pid,) in query}


def project_map(db: Session) -> dict[int, Project]:
    return {p.id: p for p in db.query(Project).all()}


def milestone_names(db: Session) -> dict[int, str]:
    return {mid: name or "Untitled milestone" for mid, name in db.query(Milestone.id, Milestone.name)}


def risk_to_out(risk: Risk, projects: dict[int, Project]) -> RiskOut:
    project = projects.get(risk.project_id or 0)
    return RiskOut(
        id=risk.id,
        project_id=risk.project_id,
        project_name=project.name if project else None,
        project_code=project.code if project else None,
        business=project.business if project else None,
        risk_type=risk.risk_type or "Risk",
        title=risk.title or risk.description or "Untitled risk",
        description=risk.description,
        impact=risk.impact,
        likelihood=risk.probability,
        severity=risk_severity(risk.impact, risk.probability),
        status=risk.status or "Open",
        owner=risk.owner,
        due_date=risk.due_date,
        mitigation=risk.mitigation,
        milestone_id=risk.milestone_id,
        created_at=risk.created_at,
    )


def action_to_out(
    action: Action, projects: dict[int, Project], milestones: dict[int, str], today: date
) -> ActionOut:
    project = projects.get(action.project_id or 0)
    return ActionOut(
        id=action.id,
        project_id=action.project_id,
        project_name=project.name if project else None,
        project_code=project.code if project else None,
        business=project.business if project else None,
        title=action.title or action.description or "Untitled action",
        description=action.description,
        owner=action.owner,
        due_date=action.due_date,
        status=action.status or "Open",
        is_overdue=is_action_overdue(action, today),
        priority=action.priority or "Medium",
        action_type=action.action_type or "Task",
        run_by=action.run_by or "Manual",
        approval_status=action.approval_status or "None",
        milestone_id=action.milestone_id,
        milestone_name=milestones.get(action.milestone_id or 0),
        created_at=action.created_at,
        completed_at=action.completed_at,
    )
