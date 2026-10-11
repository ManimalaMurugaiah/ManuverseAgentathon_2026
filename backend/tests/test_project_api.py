from collections.abc import Iterator
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
import redis
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1 import assistant
from app.api.deps import get_db
from app.core.security import create_access_token
from app.db.session import Base
from app.main import app
from app.models.user import User
from app.models.workflow import WorkflowRun
from app.services.redis_client import redis_client
from app.services.workflow.orchestrator import orchestrator


def test_workflow_and_dashboard_endpoints(monkeypatch) -> None:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    with TestingSession() as db:
        db.add(User(username="api-admin", password_hash="unused", role="admin"))
        db.add_all(
            [
                WorkflowRun(
                    id=1,
                    project_code="PRJ-A",
                    current_stage="Design Freeze",
                    status="running",
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                ),
                WorkflowRun(
                    id=2,
                    project_code="PRJ-B",
                    current_stage="Commissioning",
                    status="completed",
                    created_at=datetime.now(timezone.utc) - timedelta(days=1),
                    updated_at=datetime.now(timezone.utc) - timedelta(days=1),
                ),
            ]
        )
        db.commit()

    def override_get_db() -> Iterator[Session]:
        with TestingSession() as db:
            yield db

    async def fake_generate(prompt: str) -> str:
        assert "PRJ-A" in prompt
        return "One workflow is currently running."

    def fail_redis(*args, **kwargs):
        raise redis.ConnectionError("Redis is unavailable")

    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr(assistant.ai_service, "generate", fake_generate)
    monkeypatch.setattr(redis_client, "hset", fail_redis)
    client = TestClient(app)
    headers = {
        "Authorization": f"Bearer {create_access_token('api-admin', 'admin')}",
    }

    try:
        all_summary = client.get("/api/v1/dashboard/summary", headers=headers)
        project_summary = client.get(
            "/api/v1/dashboard/summary",
            params={"project_code": "PRJ-A"},
            headers=headers,
        )
        projects = client.get("/api/v1/workflow/projects", headers=headers)
        runs = client.get("/api/v1/workflow/runs", headers=headers)
        chat = client.post(
            "/api/v1/assistant/chat",
            json={"message": "What is running?"},
            headers=headers,
        )
        started_run = client.post(
            "/api/v1/workflow/runs",
            json={"project_code": "PRJ-A"},
            headers=headers,
        )

        assert all_summary.status_code == 200
        assert all_summary.json() == {
            "total_runs": 2,
            "running": 1,
            "blocked": 0,
            "completed": 1,
        }
        assert project_summary.status_code == 200
        assert project_summary.json()["total_runs"] == 1
        assert projects.json() == ["PRJ-A", "PRJ-B"]
        assert [run["id"] for run in runs.json()] == [1, 2]
        assert runs.json()[0]["updated_at"]
        assert chat.status_code == 200
        assert chat.json()["reply"] == "One workflow is currently running."
        assert started_run.status_code == 200
        assert started_run.json()["status"] == "running"
    finally:
        app.dependency_overrides.clear()
        engine.dispose()
