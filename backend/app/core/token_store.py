from threading import Lock

_revoked_tokens: set[str] = set()
_lock = Lock()


def revoke_token(token: str) -> None:
    with _lock:
        _revoked_tokens.add(token)


def is_token_revoked(token: str) -> bool:
    with _lock:
        return token in _revoked_tokens
