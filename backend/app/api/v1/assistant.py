from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.user import User
from app.models.workflow import WorkflowRun
from app.schemas.assistant import AssistantChatRequest, AssistantChatResponse
from app.services.ai.provider import ai_service

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/chat", response_model=AssistantChatResponse)
async def chat(
    payload: AssistantChatRequest,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager", "engineering", "approver", "viewer"))],
) -> AssistantChatResponse:
    query = db.query(WorkflowRun)
    if payload.project_code:
        query = query.filter(WorkflowRun.project_code == payload.project_code)
    runs = query.order_by(WorkflowRun.updated_at.desc()).limit(20).all()
    run_context = "\n".join(
        f"- {run.project_code}: {run.status} at {run.current_stage}"
        for run in runs
    ) or "No workflow runs have been created."
    prompt = (
        "You are the project orchestration assistant. Use only the project data below; "
        "do not invent owners, dates, or milestone details. Be concise and identify uncertainty.\n\n"
        f"Recent workflow runs:\n{run_context}\n\n"
        f"User question: {payload.message.strip()}"
    )

    try:
        reply = await ai_service.generate(prompt)
    except (httpx.HTTPError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail=f"AI assistant is unavailable: {exc}") from exc

    if not reply.strip():
        raise HTTPException(status_code=502, detail="AI provider returned an empty response.")
    return AssistantChatResponse(reply=reply)
