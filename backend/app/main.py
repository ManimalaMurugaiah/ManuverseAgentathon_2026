import logging

from fastapi import FastAPI
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.security_controls import AuditLogMiddleware
from app.core.security_controls import RateLimitMiddleware
from app.core.security_controls import RequestContextMiddleware
from app.core.security_controls import RequestSizeLimitMiddleware
from app.core.security_controls import SecurityHeadersMiddleware
from app.db.seed import seed_defaults
from app.db.session import Base, SessionLocal, engine
from app.models import User, WorkflowLog, WorkflowRun

app = FastAPI(title=settings.app_name)
logger = logging.getLogger("manuverse.security")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, __: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": "Request validation failed"})


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error path=%s request_id=%s", request.url.path, getattr(request.state, "request_id", "n/a"))
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.add_middleware(RequestContextMiddleware)
app.add_middleware(RequestSizeLimitMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(AuditLogMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_defaults(db)
    finally:
        db.close()


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Manuverse Agent Orchestrator API"}
