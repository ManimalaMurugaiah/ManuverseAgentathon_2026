from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import require_roles
from app.models.user import User
from app.schemas.governance import GovernanceEvaluateRequest, GovernanceEvaluateResponse
from project_delivery_ai.sql_governance import SeedGovernancePolicy

router = APIRouter(prefix="/governance", tags=["governance"])

_POLICY = SeedGovernancePolicy(Path(__file__).resolve().parents[3] / "data" / "sql_seed_reference.json")


@router.post("/evaluate", response_model=GovernanceEvaluateResponse)
def evaluate_rules(
    payload: GovernanceEvaluateRequest,
    _: Annotated[User, Depends(require_roles("admin", "manager", "viewer"))],
) -> GovernanceEvaluateResponse:
    findings = _POLICY.evaluate_facts(payload.facts)
    return GovernanceEvaluateResponse(findings=findings)


@router.get("/reference")
def reference_summary(
    _: Annotated[User, Depends(require_roles("admin", "manager", "viewer"))],
) -> dict[str, int]:
    return {
        "roles": len(_POLICY.reference.get("roles", [])),
        "stages": len(_POLICY.reference.get("stages", [])),
        "rules": len(_POLICY.reference.get("governance_rules", [])),
    }
