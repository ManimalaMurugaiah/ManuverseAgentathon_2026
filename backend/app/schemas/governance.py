from pydantic import BaseModel, Field


class GovernanceEvaluateRequest(BaseModel):
    facts: dict[str, str | int | float | bool] = Field(default_factory=dict)


class GovernanceEvaluateResponse(BaseModel):
    findings: list[dict]
