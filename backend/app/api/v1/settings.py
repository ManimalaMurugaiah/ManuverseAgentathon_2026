import json
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.config import settings as app_config
from app.core.security import get_password_hash, validate_password_policy
from app.db.session import get_db
from app.models.operations import AppSetting, GovernanceRule
from app.models.user import User
from app.schemas.operations import (
    GovernanceRuleOut,
    GovernanceRuleUpdate,
    IntegrationOut,
    SettingsOut,
    SettingsUpdate,
    UserCreate,
    UserOut,
    UserUpdate,
)

router = APIRouter(tags=["settings"])

READ_ROLES = ("admin", "manager", "engineering", "approver", "viewer")
SETTINGS_WRITE_ROLES = ("admin", "manager")
ADMIN = ("admin",)


def _load_settings(db: Session) -> SettingsOut:
    stored = {}
    for row in db.query(AppSetting).all():
        try:
            stored[row.key] = json.loads(row.value)
        except ValueError:
            continue
    # Unknown or invalid stored values fall back to defaults rather than breaking the page.
    valid = {k: v for k, v in stored.items() if k in SettingsOut.model_fields}
    try:
        return SettingsOut(**valid)
    except ValueError:
        return SettingsOut()


@router.get("/settings")
def get_settings(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*READ_ROLES))],
) -> SettingsOut:
    return _load_settings(db)


@router.patch("/settings")
def update_settings(
    payload: SettingsUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(*SETTINGS_WRITE_ROLES))],
) -> SettingsOut:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    for key, value in payload.model_dump(exclude_unset=True).items():
        if value is None:
            continue
        row = db.get(AppSetting, key)
        if row is None:
            db.add(AppSetting(key=key, value=json.dumps(value), updated_by=user.username, updated_at=now))
        else:
            row.value, row.updated_by, row.updated_at = json.dumps(value), user.username, now
    db.commit()
    return _load_settings(db)


@router.get("/settings/integrations")
def integrations(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*READ_ROLES))],
) -> list[IntegrationOut]:
    current = _load_settings(db)
    try:
        db.execute(text("SELECT 1"))
        database = "Connected"
    except SQLAlchemyError:
        database = "Unavailable"
    return [
        IntegrationOut(name="Database", detail="Project, risk, and action data source", status=database),
        IntegrationOut(
            name="Email", detail="Send milestone and action notifications",
            status="Enabled" if current.email_notifications else "Disabled",
        ),
        IntegrationOut(
            name="AI insights", detail=f"Summaries and next steps via {app_config.ai_provider}",
            status="Enabled" if current.ai_insights else "Disabled",
        ),
    ]


# ---- Users & roles ----
def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id, username=user.username, email=user.email, role=user.role or "viewer",
        is_active=user.is_active is not False, created_at=user.created_at,
    )


def _check_password(password: str) -> None:
    valid, message = validate_password_policy(password)
    if not valid:
        raise HTTPException(status_code=400, detail=message)


@router.get("/users")
def list_users(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*READ_ROLES))],
) -> list[UserOut]:
    return [_user_out(u) for u in db.query(User).order_by(User.id)]


@router.post("/users", status_code=201, responses={400: {"description": "Weak password"}, 409: {"description": "Duplicate user"}})
def create_user(
    payload: UserCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*ADMIN))],
) -> UserOut:
    _check_password(payload.password)
    if db.query(User.id).filter(User.username == payload.username).first():
        raise HTTPException(status_code=409, detail="That username is already taken")
    if payload.email and db.query(User.id).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="That email address is already in use")

    user = User(
        username=payload.username,
        email=payload.email,
        role=payload.role,
        password_hash=get_password_hash(payload.password),
        is_active=True,
        created_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_out(user)


@router.patch(
    "/users/{user_id}",
    responses={400: {"description": "Not allowed"}, 404: {"description": "User not found"}, 409: {"description": "Duplicate email"}},
)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[User, Depends(require_roles(*ADMIN))],
) -> UserOut:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    data = payload.model_dump(exclude_unset=True)
    if user.username == actor.username and (data.get("is_active") is False or data.get("role") not in (None, "admin")):
        raise HTTPException(status_code=400, detail="You cannot remove your own admin access")
    if data.get("email") and db.query(User.id).filter(User.email == data["email"], User.id != user.id).first():
        raise HTTPException(status_code=409, detail="That email address is already in use")

    if data.get("password"):
        _check_password(data["password"])
        user.password_hash = get_password_hash(data["password"])
    if "email" in data:
        user.email = data["email"]
    if data.get("role"):
        user.role = data["role"]
    if data.get("is_active") is not None:
        user.is_active = data["is_active"]
    db.commit()
    db.refresh(user)
    return _user_out(user)


# ---- Governance rules ----
def _rule_out(rule: GovernanceRule) -> GovernanceRuleOut:
    def parse(raw: str | None) -> dict:
        try:
            value = json.loads(raw) if raw else {}
        except ValueError:
            return {}
        return value if isinstance(value, dict) else {}

    return GovernanceRuleOut(
        id=rule.id, code=rule.code, name=rule.name, category=rule.category, severity=rule.severity,
        condition=parse(rule.condition_json), action=parse(rule.action_json), is_active=bool(rule.is_active),
    )


@router.get("/governance/rules")
def list_rules(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*READ_ROLES))],
) -> list[GovernanceRuleOut]:
    return [_rule_out(r) for r in db.query(GovernanceRule).order_by(GovernanceRule.id)]


@router.patch("/governance/rules/{rule_id}", responses={404: {"description": "Rule not found"}})
def update_rule(
    rule_id: int,
    payload: GovernanceRuleUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(*ADMIN))],
) -> GovernanceRuleOut:
    rule = db.get(GovernanceRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    rule.is_active = payload.is_active
    db.commit()
    db.refresh(rule)
    return _rule_out(rule)
