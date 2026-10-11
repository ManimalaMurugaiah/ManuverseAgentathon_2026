import os
import sys
from datetime import date

sys.path.insert(0, os.getcwd())

from app.db.session import SessionLocal
from app.models.project import Milestone, Project

db = SessionLocal()
try:
    project = Project(code="TMP-ROLLBACK", name="Rollback probe", owner="probe", start_date=date(2026, 10, 1), end_date=date(2026, 11, 1), status="Planning", ai_agents_enabled=True)
    db.add(project)
    db.flush()
    milestone = Milestone(project_id=project.id, name="Probe", owner="probe", due_date=date(2026, 10, 15), status="Not Started", progress=0, critical=False)
    db.add(milestone)
    db.flush()
    print("insert_ok", project.id, milestone.id)
finally:
    db.rollback()
    db.close()
