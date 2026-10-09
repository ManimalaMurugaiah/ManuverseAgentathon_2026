from datetime import datetime
from datetime import timezone
from datetime import timedelta
from threading import Lock
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.deps import oauth2_scheme
from app.core.config import settings
from app.core.refresh_store import is_refresh_token_active
from app.core.refresh_store import revoke_refresh_token
from app.core.refresh_store import store_refresh_token
from app.core.security import create_access_token, create_refresh_token, decode_token, verify_password
from app.core.token_store import revoke_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshTokenRequest, Token

router = APIRouter(prefix="/auth", tags=["auth"])
INVALID_REFRESH_TOKEN = "Invalid refresh token"

_failed_attempts: dict[str, int] = {}
_lockouts_until: dict[str, datetime] = {}
_auth_state_lock = Lock()


def _normalize_username(username: str) -> str:
    return username.strip().lower()


def _is_locked(username: str) -> bool:
    with _auth_state_lock:
        until = _lockouts_until.get(username)
        if not until:
            return False
        if until <= datetime.now(timezone.utc):
            _lockouts_until.pop(username, None)
            _failed_attempts.pop(username, None)
            return False
        return True


def _register_failed_attempt(username: str) -> None:
    with _auth_state_lock:
        attempts = _failed_attempts.get(username, 0) + 1
        _failed_attempts[username] = attempts
        if attempts >= settings.max_failed_login_attempts:
            _lockouts_until[username] = datetime.now(timezone.utc) + timedelta(minutes=settings.lockout_minutes)


def _reset_auth_state(username: str) -> None:
    with _auth_state_lock:
        _failed_attempts.pop(username, None)
        _lockouts_until.pop(username, None)


@router.post("/login", responses={401: {"description": "Invalid username or password"}})
def login(payload: LoginRequest, db: Annotated[Session, Depends(get_db)]) -> Token:
    username = _normalize_username(payload.username)

    if _is_locked(username):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    user = db.query(User).filter(User.username == payload.username.strip()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        _register_failed_attempt(username)
        raise HTTPException(status_code=401, detail="Invalid username or password")

    _reset_auth_state(username)

    refresh_token = create_refresh_token(subject=user.username)
    refresh_exp = datetime.now(timezone.utc) + timedelta(minutes=settings.refresh_token_expire_minutes)
    store_refresh_token(refresh_token, refresh_exp)

    token = create_access_token(
        subject=user.username,
        role=user.role,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return Token(access_token=token, refresh_token=refresh_token)


@router.post("/refresh", responses={401: {"description": "Invalid refresh token"}})
def refresh_token(payload: RefreshTokenRequest, db: Annotated[Session, Depends(get_db)]) -> Token:
    if not is_refresh_token_active(payload.refresh_token):
        raise HTTPException(status_code=401, detail=INVALID_REFRESH_TOKEN)

    try:
        decoded = decode_token(payload.refresh_token)
    except Exception as exc:  # pragma: no cover - guarded response
        raise HTTPException(status_code=401, detail=INVALID_REFRESH_TOKEN) from exc

    if decoded.get("type") != "refresh":
        raise HTTPException(status_code=401, detail=INVALID_REFRESH_TOKEN)

    username = decoded.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail=INVALID_REFRESH_TOKEN)

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail=INVALID_REFRESH_TOKEN)

    revoke_refresh_token(payload.refresh_token)
    next_refresh = create_refresh_token(subject=user.username)
    next_refresh_exp = datetime.now(timezone.utc) + timedelta(minutes=settings.refresh_token_expire_minutes)
    store_refresh_token(next_refresh, next_refresh_exp)

    access = create_access_token(
        subject=user.username,
        role=user.role,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return Token(access_token=access, refresh_token=next_refresh)


@router.get("/me")
def me(user: Annotated[User, Depends(get_current_user)]) -> dict[str, str]:
    return {"username": user.username, "role": user.role}


@router.post("/logout")
def logout(token: Annotated[str, Depends(oauth2_scheme)]) -> dict[str, str]:
    revoke_token(token)
    return {"message": "Logged out"}


@router.post("/logout-refresh")
def logout_refresh(payload: RefreshTokenRequest) -> dict[str, str]:
    revoke_refresh_token(payload.refresh_token)
    return {"message": "Refresh token revoked"}
