from datetime import date

from fastapi import HTTPException
from sqlalchemy import case, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.project import Milestone, MilestoneApprovalStep, MilestoneEvidence, Project
from app.models.user import User
from app.schemas.project import (
    ApprovalStepOut,
    ApprovalWorkflowOut,
    EvidenceOut,
    MilestoneOut,
    ProjectOut,
)

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


def to_project_out(project: Project, stats: dict[int, ProjectStats]) -> ProjectOut:
    count, progress, delayed, at_risk = stats.get(project.id, (0, 0, 0, 0))
    if delayed:
        health = "Delayed"
    elif at_risk:
        health = "At risk"
    else:
        health = "On track"
    return ProjectOut(
        id=project.id,
        code=project.code,
        name=project.name or "Untitled project",
        owner=project.owner,
        country=project.country,
        plant=project.plant,
        budget=project.budget,
        status=project.status,
        health=health,
        progress=progress,
        milestone_count=count,
        start_date=project.start_date,
        end_date=project.end_date,
        ai_agents_enabled=bool(project.ai_agents_enabled),
    )


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
