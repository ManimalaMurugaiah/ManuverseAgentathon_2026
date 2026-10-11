import os

os.environ.setdefault("DATABASE_URL", "sqlite://")

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.api.v1.router import api_router
from app.db.session import Base, get_db
from app.models.user import User


class _Session:
    role = "admin"


@pytest.fixture()
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_db():
        db = factory()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.include_router(api_router, prefix="/api/v1")
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: User(username="tester", password_hash="x", role=_Session.role)
    _Session.role = "admin"
    return TestClient(app)


def _project(client, **overrides):
    body = {"name": "Alpha Plant", "owner": "Ravi K.", "start_date": "2026-10-10", "end_date": "2026-12-20"}
    body.update(overrides)
    return client.post("/api/v1/projects", json=body)


def _milestone(client, project_id, **overrides):
    body = {"name": "PO Release", "owner": "Anita S.", "due_date": "2026-10-12"}
    body.update(overrides)
    return client.post(f"/api/v1/projects/{project_id}/milestones", json=body)


def test_create_project_generates_code_and_lists_it(client):
    created = _project(client)
    assert created.status_code == 201
    assert created.json()["code"] == "PRJ001"
    assert created.json()["health"] == "On track"

    listing = client.get("/api/v1/projects").json()
    assert listing["total"] == 1
    assert listing["owners"] == ["Ravi K."]


def test_project_validation_and_duplicate_code(client):
    assert _project(client, end_date="2026-01-01").status_code == 422
    assert _project(client, code="ALPHA").status_code == 201
    assert _project(client, code="alpha").status_code == 409


def test_search_treats_wildcards_literally(client):
    _project(client)
    assert client.get("/api/v1/projects", params={"search": "%"}).json()["total"] == 0
    assert client.get("/api/v1/projects", params={"search": "alpha"}).json()["total"] == 1


def test_health_and_progress_derive_from_milestones(client):
    pid = _project(client).json()["id"]
    _milestone(client, pid, name="Design Review", status="In Progress", progress=60)
    _milestone(client, pid, name="Vendor Delivery", status="Delayed", progress=20)

    project = client.get(f"/api/v1/projects/{pid}").json()
    assert project["health"] == "Delayed"
    assert project["progress"] == 40
    assert client.get("/api/v1/projects", params={"health": "On track"}).json()["total"] == 0
    assert client.get("/api/v1/projects", params={"health": "Delayed"}).json()["total"] == 1


def test_milestone_status_and_progress_stay_consistent(client):
    pid = _project(client).json()["id"]
    mid = _milestone(client, pid).json()["id"]

    started = client.patch(f"/api/v1/milestones/{mid}", json={"progress": 40}).json()
    assert started["status"] == "In Progress"

    done = client.patch(f"/api/v1/milestones/{mid}", json={"progress": 100}).json()
    assert done["status"] == "Completed"
    assert done["actual_date"] is not None

    assert client.patch(f"/api/v1/milestones/{mid}", json={"status": "In Progress"}).status_code == 400
    reopened = client.patch(f"/api/v1/milestones/{mid}", json={"status": "In Progress", "progress": 80}).json()
    assert reopened["actual_date"] is None
    assert _milestone(client, pid, status="Not Started", progress=10).status_code == 400


def test_viewer_cannot_write(client):
    _Session.role = "viewer"
    assert _project(client).status_code == 403
    assert client.get("/api/v1/projects").status_code == 200


def test_unknown_project_and_milestone_return_404(client):
    assert client.get("/api/v1/projects/99/milestones").status_code == 404
    assert client.patch("/api/v1/milestones/99", json={"progress": 1}).status_code == 404


def test_approval_workflow_enforces_step_roles_and_closes_milestone(client):
    pid = _project(client).json()["id"]
    mid = _milestone(client, pid, status="In Progress", progress=60).json()["id"]

    steps = client.get(f"/api/v1/milestones/{mid}/approvals").json()["steps"]
    assert [s["status"] for s in steps] == ["Pending", "Waiting", "Waiting", "Waiting"]
    assert steps[0]["actor"] == "Anita S."

    _Session.role = "engineering"
    assert client.post(f"/api/v1/milestones/{mid}/approvals/advance").status_code == 200
    assert client.post(f"/api/v1/milestones/{mid}/approvals/advance").status_code == 200
    assert client.post(f"/api/v1/milestones/{mid}/approvals/advance").status_code == 403

    _Session.role = "approver"
    final = client.post(f"/api/v1/milestones/{mid}/approvals/advance").json()
    assert [s["status"] for s in final["steps"]] == ["Done"] * 4
    assert client.post(f"/api/v1/milestones/{mid}/approvals/advance").status_code == 409

    milestone = client.get(f"/api/v1/projects/{pid}/milestones").json()["items"][0]
    assert milestone["status"] == "Completed"
    assert milestone["progress"] == 100


def test_evidence_validates_name_and_completes_first_step(client):
    pid = _project(client).json()["id"]
    mid = _milestone(client, pid).json()["id"]

    assert client.post(f"/api/v1/milestones/{mid}/evidence", json={"file_name": "run.exe"}).status_code == 422
    assert client.post(f"/api/v1/milestones/{mid}/evidence", json={"file_name": "../etc/passwd.pdf"}).status_code == 422

    ok = client.post(f"/api/v1/milestones/{mid}/evidence", json={"file_name": "Delivery_note.pdf"})
    assert ok.status_code == 201
    assert ok.json()["steps"][0]["status"] == "Done"
    assert ok.json()["steps"][1]["status"] == "Pending"
    assert client.post(f"/api/v1/milestones/{mid}/evidence", json={"file_name": "delivery_note.PDF"}).status_code == 409
