from fastapi import APIRouter
from app.api.v1.assistant import router as assistant_router
from app.api.v1.auth import router as auth_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.governance import router as governance_router
from app.api.v1.health import router as health_router
from app.api.v1.milestones import router as milestones_router
from app.api.v1.projects import router as projects_router
from app.api.v1.workflow import router as workflow_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(assistant_router)
api_router.include_router(auth_router)
api_router.include_router(workflow_router)
api_router.include_router(dashboard_router)
api_router.include_router(governance_router)
api_router.include_router(projects_router)
api_router.include_router(milestones_router)
