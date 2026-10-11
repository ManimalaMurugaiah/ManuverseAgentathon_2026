from datetime import date, timedelta

from fastapi import HTTPException
from sqlalchemy import case, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.operations import Action, Risk
from app.models.project import Milestone, MilestoneApprovalStep, MilestoneEvidence, Project
from app.models.reference import ProcessStage, ProcessTemplate
from app.models.user import User
from app.schemas.project import (
    ApprovalStepOut,
    ApprovalWorkflowOut,
    EvidenceOut,
    MilestoneOut,
    ProjectDetail,
    ProjectMetrics,
    ProjectOut,
)
from app.services.ops_service import CLOSED_ACTION_STATUSES, is_action_overdue, risk_severity

PROJECT_NOT_FOUND = "Project not found"
MILESTONE_NOT_FOUND = "Milestone not found"
NOT_STARTED = "Not Started"

# step_no -> (name, fixed actor); actor None means the milestone owner.
APPROVAL_TEMPLATE = [
    (1, "Evidence submitted", None),
    (2, "Engineering Lead review", "Engineering Lead"),
    (3, "Procurement approval", "Procurement Lead"),
    (4, "Milestone closed", "System"),
]
STEP_ROLES = {
    1: {"admin", "manager", "engineering"},
    2: {"admin", "manager", "engineering"},
    3: {"admin", "manager", "approver"},
}

ProjectStats = tuple[int, int, int, int]  # milestone count, avg progress, delayed, at risk


def project_stats(db: Session) -> dict[int, ProjectStats]:
    rows = (
        db.query(
            Milestone.project_id,
            func.count(Milestone.id),
            func.avg(Milestone.progress),
            func.sum(case((Milestone.status == "Delayed", 1), else_=0)),
            func.sum(case((Milestone.status == "At Risk", 1), else_=0)),
        )
        .group_by(Milestone.project_id)
        .all()
    )
    return {
        row[0]: (int(row[1]), round(float(row[2] or 0)), int(row[3] or 0), int(row[4] or 0))
        for row in rows
    }


def schedule_status(project: Project, stats: dict[int, ProjectStats]) -> str:
    if project.status == "Completed":
        return "Completed"
    _, _, delayed, at_risk = stats.get(project.id, (0, 0, 0, 0))
    if delayed:
        return "Delayed"
    return "At risk" if at_risk else "On track"


def location_label(project: Project) -> str | None:
    return ", ".join(part for part in (project.plant, project.country) if part) or None


def to_project_out(project: Project, stats: dict[int, ProjectStats]) -> ProjectOut:
    count, progress, _, _ = stats.get(project.id, (0, 0, 0, 0))
    return ProjectOut(
        id=project.id,
        code=project.code,
        name=project.name or "Untitled project",
        project_type=project.project_type,
        owner=project.owner,
        business=project.business,
        country=project.country,
        plant=project.plant,
        location=location_label(project),
        budget=project.budget,
        budget_spent=project.budget_spent or 0,
        status=project.status,
        schedule_status=schedule_status(project, stats),
        health=project.health_rating or "Good",
        progress=progress,
        milestone_count=count,
        start_date=project.start_date,
        end_date=project.end_date,
        forecast_date=project.forecast_date,
        ai_agents_enabled=bool(project.ai_agents_enabled),
    )


def to_project_detail(db: Session, project: Project) -> ProjectDetail:
    base = to_project_out(project, project_stats(db))
    today = date.today()

    by_status = dict(
        db.query(Milestone.status, func.count(Milestone.id))
        .filter(Milestone.project_id == project.id)
        .group_by(Milestone.status)
        .all()
    )
    severity = {"High": 0, "Medium": 0, "Low": 0}
    for risk in db.query(Risk).filter(Risk.project_id == project.id, Risk.status != "Resolved").all():
        severity[risk_severity(risk.impact, risk.probability)] += 1

    open_actions = [
        a for a in db.query(Action).filter(Action.project_id == project.id).all()
        if a.status not in CLOSED_ACTION_STATUSES
    ]
    spent_pct = 0
    if project.budget:
        spent_pct = min(100, round(float(project.budget_spent or 0) / float(project.budget) * 100))
    duration = (project.end_date - project.start_date).days if project.start_date and project.end_date else None

    metrics = ProjectMetrics(
        milestones_total=base.milestone_count,
        milestones_completed=by_status.get("Completed", 0),
        milestones_in_progress=by_status.get("In Progress", 0),
        milestones_not_started=by_status.get(NOT_STARTED, 0),
        milestones_delayed=by_status.get("Delayed", 0),
        milestones_at_risk=by_status.get("At Risk", 0),
        risks_high=severity["High"],
        risks_medium=severity["Medium"],
        risks_low=severity["Low"],
        actions_open=len(open_actions),
        actions_overdue=sum(1 for a in open_actions if is_action_overdue(a, today)),
        actions_due_soon=sum(
            1 for a in open_actions
            if a.due_date and today <= a.due_date <= today + timedelta(days=7)
        ),
        budget_spent_pct=spent_pct,
    )
    return ProjectDetail(
        **base.model_dump(),
        description=project.description,
        business_objective=project.business_objective,
        scope=project.scope,
        sponsor=project.sponsor,
        resources=project.resources,
        risk_level=project.risk_level,
        duration_days=duration,
        metrics=metrics,
    )


def generate_milestones_from_template(db: Session, project: Project, template_id: int) -> int:
    """Create one milestone per template stage, spaced evenly from project start to end."""
    if not db.get(ProcessTemplate, template_id):
        raise HTTPException(status_code=400, detail="Process template not found")
    stages = (
        db.query(ProcessStage)
        .filter(ProcessStage.template_id == template_id)
        .order_by(ProcessStage.sequence, ProcessStage.id)
        .all()
    )
    if not stages or not project.start_date or not project.end_date:
        return 0

    span = (project.end_date - project.start_date).days
    for index, stage in enumerate(stages, start=1):
        due = project.start_date + timedelta(days=round(span * index / len(stages)))
        db.add(
            Milestone(
                project_id=project.id,
                name=(stage.name or f"Stage {index}")[:200],
                owner=project.owner,
                due_date=due,
                forecast_date=due,
                status=NOT_STARTED,
                progress=0,
                critical=False,
            )
        )
    return len(stages)


def to_milestone_out(milestone: Milestone) -> MilestoneOut:
    return MilestoneOut(
        id=milestone.id,
        project_id=milestone.project_id or 0,
        name=milestone.name or "Untitled milestone",
        owner=milestone.owner,
        status=milestone.status or NOT_STARTED,
        progress=milestone.progress or 0,
        due_date=milestone.due_date,
        forecast_date=milestone.forecast_date,
        actual_date=milestone.actual_date,
        critical=bool(milestone.critical),
    )


def resolve_status_progress(status: str, progress: int, progress_given: bool) -> tuple[str, int]:
    """Keep status and progress consistent; raises ValueError for contradictory input."""
    if status == "Completed":
        return status, 100
    if status == NOT_STARTED and not progress_given:
        progress = 0
    if progress == 100:
        raise ValueError("A milestone at 100% must be Completed")
    if status == NOT_STARTED and progress > 0:
        raise ValueError("A Not Started milestone cannot have progress")
    return status, progress


def get_project_or_404(db: Session, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail=PROJECT_NOT_FOUND)
    return project


def get_milestone_or_404(db: Session, milestone_id: int) -> Milestone:
    milestone = db.get(Milestone, milestone_id)
    if not milestone:
        raise HTTPException(status_code=404, detail=MILESTONE_NOT_FOUND)
    return milestone


def _ordered_steps(db: Session, milestone_id: int) -> list[MilestoneApprovalStep]:
    return (
        db.query(MilestoneApprovalStep)
        .filter(MilestoneApprovalStep.milestone_id == milestone_id)
        .order_by(MilestoneApprovalStep.step_no)
        .all()
    )


def ensure_steps(db: Session, milestone: Milestone) -> list[MilestoneApprovalStep]:
    steps = _ordered_steps(db, milestone.id)
    if steps:
        return steps

    done = milestone.status == "Completed"
    for step_no, name, actor in APPROVAL_TEMPLATE:
        if done:
            status = "Done"
        else:
            status = "Pending" if step_no == 1 else "Waiting"
        db.add(
            MilestoneApprovalStep(
                milestone_id=milestone.id, step_no=step_no, name=name, actor=actor, status=status
            )
        )
    try:
        db.commit()
    except IntegrityError:
        # A concurrent request created the steps first.
        db.rollback()
    return _ordered_steps(db, milestone.id)


def _complete_milestone(milestone: Milestone) -> None:
    milestone.status = "Completed"
    milestone.progress = 100
    milestone.actual_date = milestone.actual_date or date.today()


def advance_approval(db: Session, milestone: Milestone, user: User) -> None:
    steps = ensure_steps(db, milestone)
    current = next((s for s in steps if s.status == "Pending"), None)
    if current is None:
        raise HTTPException(status_code=409, detail="No approval step is pending")
    if user.role not in STEP_ROLES.get(current.step_no, set()):
        raise HTTPException(status_code=403, detail="Insufficient permissions for this approval step")

    current.status = "Done"
    following = next((s for s in steps if s.step_no == current.step_no + 1), None)
    if following is not None:
        following.status = "Pending"
        if following.actor == "System":
            following.status = "Done"
            _complete_milestone(milestone)
    db.commit()


def add_evidence(db: Session, milestone: Milestone, file_name: str, user: User) -> None:
    steps = ensure_steps(db, milestone)
    duplicate = (
        db.query(MilestoneEvidence.id)
        .filter(MilestoneEvidence.milestone_id == milestone.id, func.lower(MilestoneEvidence.file_name) == file_name.lower())
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Evidence with this file name already exists")

    db.add(MilestoneEvidence(milestone_id=milestone.id, file_name=file_name, uploaded_by=user.username))
    first, second = steps[0], steps[1]
    if first.status == "Pending":
        first.status = "Done"
        second.status = "Pending"
    db.commit()


def to_approval_out(db: Session, milestone: Milestone) -> ApprovalWorkflowOut:
    steps = ensure_steps(db, milestone)
    evidence = (
        db.query(MilestoneEvidence)
        .filter(MilestoneEvidence.milestone_id == milestone.id)
        .order_by(MilestoneEvidence.id)
        .all()
    )
    return ApprovalWorkflowOut(
        milestone_id=milestone.id,
        milestone_name=milestone.name or "Untitled milestone",
        steps=[
            ApprovalStepOut(
                id=s.id, step_no=s.step_no, name=s.name, actor=s.actor or milestone.owner, status=s.status
            )
            for s in steps
        ],
        evidence=[
            EvidenceOut(id=e.id, file_name=e.file_name, uploaded_by=e.uploaded_by, uploaded_at=e.uploaded_at)
            for e in evidence
        ],
    )
