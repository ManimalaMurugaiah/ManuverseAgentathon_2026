from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.operations import ReportSchedule, SavedReport
from app.models.project import Project
from app.models.user import User
from app.schemas.reports import (
    ReportData,
    ReportInterval,
    SavedReportCreate,
    SavedReportOut,
    ScheduleCreate,
    ScheduleOut,
    ScheduleUpdate,
)
from app.services.project_service import PROJECT_NOT_FOUND
from app.services.report_service import build_report
from app.services.register_service import project_map

router = APIRouter(prefix="/reports", tags=["reports"])

READ_ROLES = ("admin", "manager", "engineering", "approver", "viewer")
SCHEDULE_ROLES = ("admin", "manager")
SCHEDULE_NOT_FOUND = "Schedule not found"
REPORT_NOT_FOUND = "Report not found"


@router.get("/data", responses={400: {"description": "Invalid reporting period"}})
def report_data(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*READ_ROLES))],
    interval: ReportInterval,
    value: Annotated[str, Query(min_length=4, max_length=10)],
    project_id: int | None = None,
    business: Annotated[str | None, Query(max_length=150)] = None,
) -> ReportData:
    try:
        return build_report(db, project_id, business, interval, value)
    except (ValueError, IndexError) as exc:
        raise HTTPException(status_code=400, detail="Invalid reporting period") from exc


def _saved_out(report: SavedReport, projects: dict[int, Project]) -> SavedReportOut:
    project = projects.get(report.project_id or 0)
    return SavedReportOut(
        id=report.id,
        title=report.title,
        report_type=report.report_type,
        project_id=report.project_id,
        project_name=project.name if project else None,
        period=report.period,
        created_by=report.created_by,
        created_at=report.created_at,
    )


@router.get("/saved")
def list_saved(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*READ_ROLES))],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[SavedReportOut]:
    projects = project_map(db)
    rows = db.query(SavedReport).order_by(SavedReport.id.desc()).limit(limit).all()
    return [_saved_out(r, projects) for r in rows]


@router.post("/saved", status_code=201, responses={404: {"description": PROJECT_NOT_FOUND}})
def save_report(
    payload: SavedReportCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(*READ_ROLES))],
) -> SavedReportOut:
    if payload.project_id is not None and not db.get(Project, payload.project_id):
        raise HTTPException(status_code=404, detail=PROJECT_NOT_FOUND)
    report = SavedReport(
        title=payload.title,
        report_type=payload.report_type,
        project_id=payload.project_id,
        period=payload.period,
        created_by=user.username,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return _saved_out(report, project_map(db))


@router.delete("/saved/{report_id}", status_code=204, responses={404: {"description": REPORT_NOT_FOUND}})
def delete_saved(
    report_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*SCHEDULE_ROLES))],
) -> None:
    report = db.get(SavedReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail=REPORT_NOT_FOUND)
    db.delete(report)
    db.commit()


def _schedule_out(s: ReportSchedule) -> ScheduleOut:
    return ScheduleOut(
        id=s.id, name=s.name, report_type=s.report_type, frequency=s.frequency, format=s.format,
        is_active=bool(s.is_active), created_by=s.created_by, created_at=s.created_at,
    )


@router.get("/schedules")
def list_schedules(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*READ_ROLES))],
) -> list[ScheduleOut]:
    return [_schedule_out(s) for s in db.query(ReportSchedule).order_by(ReportSchedule.id.desc())]


@router.post("/schedules", status_code=201)
def create_schedule(
    payload: ScheduleCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(*SCHEDULE_ROLES))],
) -> ScheduleOut:
    schedule = ReportSchedule(
        name=payload.name,
        report_type=payload.report_type,
        frequency=payload.frequency,
        format=payload.format,
        created_by=user.username,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return _schedule_out(schedule)


@router.patch("/schedules/{schedule_id}", responses={404: {"description": SCHEDULE_NOT_FOUND}})
def update_schedule(
    schedule_id: int,
    payload: ScheduleUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*SCHEDULE_ROLES))],
) -> ScheduleOut:
    schedule = db.get(ReportSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail=SCHEDULE_NOT_FOUND)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(schedule, field, value)
    db.commit()
    db.refresh(schedule)
    return _schedule_out(schedule)


@router.delete("/schedules/{schedule_id}", status_code=204, responses={404: {"description": SCHEDULE_NOT_FOUND}})
def delete_schedule(
    schedule_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*SCHEDULE_ROLES))],
) -> None:
    schedule = db.get(ReportSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail=SCHEDULE_NOT_FOUND)
    db.delete(schedule)
    db.commit()
