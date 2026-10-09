from datetime import datetime

from pydantic import BaseModel


class WorkflowRunCreate(BaseModel):
    project_code: str


class WorkflowStepRequest(BaseModel):
    run_id: int
    approved: bool = True
    note: str = ""


class WorkflowRunResponse(BaseModel):
    id: int
    project_code: str
    current_stage: str
    status: str
    created_at: datetime
