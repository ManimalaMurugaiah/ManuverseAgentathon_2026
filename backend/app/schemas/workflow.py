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


class WorkflowAutoRequest(BaseModel):
    run_id: int | None = None
    max_steps: int = 1
    note: str = "Auto agent processed step"


class WorkflowAutoResponse(BaseModel):
    processed_runs: int
    runs: list[WorkflowRunResponse]
