from fastapi import APIRouter
from app.api.v1.actions import router as actions_router
from app.api.v1.assistant import router as assistant_router
from app.api.v1.auth import router as auth_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.dependencies import router as dependencies_router
from app.api.v1.governance import router as governance_router
from app.api.v1.health import router as health_router
from app.api.v1.lookups import router as lookups_router
from app.api.v1.milestones import router as milestones_router
from app.api.v1.projects import router as projects_router
from app.api.v1.reports import router as reports_router
from app.api.v1.risks import router as risks_router
from app.api.v1.settings import router as settings_router
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
api_router.include_router(dependencies_router)
api_router.include_router(risks_router)
api_router.include_router(actions_router)
api_router.include_router(lookups_router)
api_router.include_router(reports_router)
api_router.include_router(settings_router)
