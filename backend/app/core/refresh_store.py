from datetime import datetime
from datetime import timezone
from threading import Lock

_tokens: dict[str, datetime] = {}
_lock = Lock()


def store_refresh_token(token: str, expires_at: datetime) -> None:
    with _lock:
        _tokens[token] = expires_at


def is_refresh_token_active(token: str) -> bool:
    now = datetime.now(timezone.utc)
    with _lock:
        expires_at = _tokens.get(token)
        if not expires_at:
            return False
        if expires_at <= now:
            _tokens.pop(token, None)
            return False
        return True


def revoke_refresh_token(token: str) -> None:
    with _lock:
        _tokens.pop(token, None)
