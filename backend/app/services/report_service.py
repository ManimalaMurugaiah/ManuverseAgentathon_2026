import calendar
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.operations import Action, Dependency, Risk
from app.models.project import Milestone, Project
from app.schemas.reports import (
    ActionRow,
    BudgetOverview,
    DependencyRow,
    MilestoneRow,
    MilestoneTrend,
    ProjectPerformance,
    ReportData,
    ReportStats,
    ReportTrendBucket,
    RiskRow,
)
from app.services.project_service import project_stats, schedule_status
from app.services.register_service import SEVERITY_ORDER, milestone_names, project_map, project_scope, risk_to_out

TREND_POINTS = 6


def _fmt(day: date, with_year: bool = False) -> str:
    text = f"{calendar.month_abbr[day.month]} {day.day}"
    return f"{text}, {day.year}" if with_year else text


def parse_window(interval: str, value: str) -> tuple[date, date, str]:
    """Return (start, end, label) for a Day/Week/Month/Year selection; raises ValueError on bad input."""
    if interval == "Day":
        day = date.fromisoformat(value)
        return day, day, _fmt(day, True)
    if interval == "Week":
        year, week = value.split("-W")
        start = date.fromisocalendar(int(year), int(week), 1)
        end = start + timedelta(days=6)
        return start, end, f"{_fmt(start)} – {_fmt(end)}, {end.year}"
    if interval == "Month":
        year, month = (int(part) for part in value.split("-"))
        start = date(year, month, 1)
        end = date(year, month, calendar.monthrange(year, month)[1])
        return start, end, f"{calendar.month_name[month]} {year}"
    year = int(value)
    return date(year, 1, 1), date(year, 12, 31), str(year)


def _buckets(interval: str, start: date, end: date) -> list[tuple[str, date, date]]:
    """At most seven bars so the chart and the PDF both stay readable."""
    if interval == "Day":
        days = [end - timedelta(days=offset) for offset in range(6, -1, -1)]
        return [(str(d.day), d, d) for d in days]
    if interval == "Week":
        days = [start + timedelta(days=i) for i in range(7)]
        return [(calendar.day_abbr[d.weekday()], d, d) for d in days]
    if interval == "Month":
        out, cursor, index = [], start, 1
        while cursor <= end:
            out.append((f"W{index}", cursor, min(cursor + timedelta(days=6), end)))
            cursor += timedelta(days=7)
            index += 1
        return out
    return [
        (f"Q{q}", date(start.year, 3 * q - 2, 1), date(start.year, 3 * q, calendar.monthrange(start.year, 3 * q)[1]))
        for q in range(1, 5)
    ]


def _band(status: str | None) -> str:
    if status == "Delayed":
        return "delayed"
    return "at_risk" if status == "At Risk" else "on_track"


def _count(milestones: list[Milestone], start: date, end: date) -> dict[str, int]:
    counts = {"on_track": 0, "at_risk": 0, "delayed": 0}
    for m in milestones:
        if m.due_date and start <= m.due_date <= end:
            counts[_band(m.status)] += 1
    return counts


def _milestone_trend(milestones: list[Milestone]) -> MilestoneTrend:
    dated = [m.due_date for m in milestones if m.due_date]
    if not dated:
        return MilestoneTrend(labels=[], planned=[], actual=[])
    first, last = min(dated), max(dated)
    span = max((last - first).days, 1)
    points = [first + timedelta(days=round(span * i / (TREND_POINTS - 1))) for i in range(TREND_POINTS)]
    return MilestoneTrend(
        labels=[_fmt(p) for p in points],
        planned=[sum(1 for m in milestones if m.due_date and m.due_date <= p) for p in points],
        actual=[
            sum(1 for m in milestones if m.status == "Completed" and (m.actual_date or m.due_date or date.max) <= p)
            for p in points
        ],
    )


def build_report(db: Session, project_id: int | None, business: str | None, interval: str, value: str) -> ReportData:
    start, end, label = parse_window(interval, value)
    scope = project_scope(db, project_id, business)
    projects = project_map(db)
    in_scope = {pid: p for pid, p in projects.items() if scope is None or pid in scope}

    milestones = [m for m in db.query(Milestone).order_by(Milestone.due_date, Milestone.id) if m.project_id in in_scope]
    window = _count(milestones, start, end)
    trend = []
    for name, b_start, b_end in _buckets(interval, start, end):
        counts = _count(milestones, b_start, b_end)
        trend.append(ReportTrendBucket(label=name, total=sum(counts.values()), **counts))

    stats = project_stats(db)
    performance = [
        ProjectPerformance(
            id=p.id, code=p.code, name=p.name or "Untitled project",
            progress=stats.get(p.id, (0, 0, 0, 0))[1], schedule_status=schedule_status(p, stats),
        )
        for p in sorted(in_scope.values(), key=lambda p: -p.id)[:5]
    ]

    total = sum((p.budget or Decimal(0) for p in in_scope.values()), Decimal(0))
    spent = sum((p.budget_spent or Decimal(0) for p in in_scope.values()), Decimal(0))
    budget = BudgetOverview(total=total, spent=spent, pct=min(100, round(float(spent) / float(total) * 100)) if total else 0)

    by_id = {m.id: m for m in milestones}
    dependency_rows = []
    for edge in db.query(Dependency).order_by(Dependency.id):
        before, after = by_id.get(edge.predecessor_id or 0), by_id.get(edge.successor_id or 0)
        if before and after:
            dependency_rows.append(
                DependencyRow(
                    dependency=f"{before.name} → {after.name}", owner=after.owner, due=after.due_date, status=after.status or ""
                )
            )

    risks = [
        risk_to_out(r, projects) for r in db.query(Risk).order_by(Risk.id.desc()) if r.project_id in in_scope
    ]
    risks.sort(key=lambda r: (r.status == "Resolved", SEVERITY_ORDER[r.severity]))
    names = milestone_names(db)
    actions = [a for a in db.query(Action).order_by(Action.due_date, Action.id) if a.project_id in in_scope]

    return ReportData(
        stats=ReportStats(range_label=label, start=start, end=end, milestones=sum(window.values()), trend=trend, **window),
        performance=performance,
        budget=budget,
        milestone_trend=_milestone_trend(milestones),
        milestones=[MilestoneRow(milestone=m.name or "", planned=m.due_date, owner=m.owner, status=m.status or "") for m in milestones],
        dependencies=dependency_rows,
        risks=[
            RiskRow(id=r.id, title=r.title, severity=r.severity, status=r.status, owner=r.owner, project=r.project_name, due_date=r.due_date)
            for r in risks
        ],
        actions=[
            ActionRow(
                id=a.id, title=a.title or a.description or "", milestone=names.get(a.milestone_id or 0), owner=a.owner,
                priority=a.priority or "Medium", due_date=a.due_date, status=a.status or "Open",
            )
            for a in actions
        ],
    )
