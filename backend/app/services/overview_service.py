from datetime import date, datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.operations import Action, Risk
from app.models.project import Milestone, Project
from app.schemas.operations import ActivityItem, MilestoneBreakdown, OverviewOut, TrendPoint
from app.schemas.project import ProjectSummary
from app.services.ops_service import CLOSED_ACTION_STATUSES
from app.services.project_service import project_stats, schedule_status
from app.services.register_service import (
    PRIORITY_ORDER,
    SEVERITY_ORDER,
    action_to_out,
    milestone_names,
    project_map,
    risk_to_out,
)

TREND_MONTHS = 6


def summarize_projects(db: Session, business: str | None) -> ProjectSummary:
    query = db.query(Project).filter(or_(Project.status.is_(None), Project.status != "Cancelled"))
    if business:
        query = query.filter(Project.business == business)
    stats = project_stats(db)
    counts = {"On track": 0, "At risk": 0, "Delayed": 0, "Completed": 0}
    projects = query.all()
    for project in projects:
        counts[schedule_status(project, stats)] += 1
    return ProjectSummary(
        total=len(projects),
        on_track=counts["On track"],
        at_risk=counts["At risk"],
        delayed=counts["Delayed"],
        completed=counts["Completed"],
    )


def _month_start(value: date, offset: int) -> date:
    index = value.year * 12 + (value.month - 1) + offset
    return date(index // 12, index % 12 + 1, 1)


def _trend(milestones: list[Milestone], today: date) -> list[TrendPoint]:
    """Share of milestones due in each month that are completed; empty months have no value."""
    points = []
    for back in range(TREND_MONTHS - 1, -1, -1):
        start = _month_start(today, -back)
        end = _month_start(today, -back + 1)
        due = [m for m in milestones if m.due_date and start <= m.due_date < end]
        value = round(100 * sum(1 for m in due if m.status == "Completed") / len(due)) if due else None
        points.append(TrendPoint(label=start.strftime("%b"), value=value))
    return points


def build_overview(db: Session, business: str | None) -> OverviewOut:
    today = date.today()
    projects = project_map(db)
    scoped = {
        pid for pid, p in projects.items()
        if p.status != "Cancelled" and (not business or p.business == business)
    }

    milestones = [m for m in db.query(Milestone).all() if m.project_id in scoped]
    breakdown = MilestoneBreakdown(
        completed=sum(1 for m in milestones if m.status == "Completed"),
        in_progress=sum(1 for m in milestones if m.status in ("In Progress", "At Risk")),
        upcoming=sum(1 for m in milestones if m.status == "Not Started"),
        delayed=sum(1 for m in milestones if m.status == "Delayed"),
    )

    risks = [risk_to_out(r, projects) for r in db.query(Risk).all() if r.project_id in scoped]
    open_risks = sorted(
        (r for r in risks if r.status != "Resolved"),
        key=lambda r: (SEVERITY_ORDER[r.severity], r.due_date is None, r.due_date),
    )

    names = milestone_names(db)
    actions = [action_to_out(a, projects, names, today) for a in db.query(Action).all() if a.project_id in scoped]
    open_actions = sorted(
        (a for a in actions if a.status not in CLOSED_ACTION_STATUSES),
        key=lambda a: (not a.is_overdue, PRIORITY_ORDER.get(a.priority, 1), a.due_date is None, a.due_date),
    )

    events: list[ActivityItem] = []
    for r in risks:
        events.append(ActivityItem(
            id=f"risk-{r.id}", label=r.title, detail=r.project_name or "", when=r.created_at,
            tone="alert" if r.severity == "High" else "warn", link="risks",
        ))
    for milestone in milestones:
        if milestone.status == "Completed" and milestone.actual_date:
            events.append(ActivityItem(
                id=f"milestone-{milestone.id}", label=f"{milestone.name} completed",
                detail=projects[milestone.project_id].name or "", tone="ok", link="milestones",
                when=datetime.combine(milestone.actual_date, datetime.min.time()),
            ))
    for a in actions:
        events.append(ActivityItem(
            id=f"action-{a.id}", label=a.title, detail=a.project_name or "",
            tone="alert" if a.is_overdue else "ok", link="actions",
            when=a.completed_at or a.created_at,
        ))
    events.sort(key=lambda e: e.when, reverse=True)

    return OverviewOut(
        summary=summarize_projects(db, business),
        milestones=breakdown,
        trend=_trend(milestones, today),
        top_risks=open_risks[:3],
        activity=events[:6],
        priority_actions=open_actions[:3],
    )
