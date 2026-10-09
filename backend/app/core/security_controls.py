from collections import defaultdict
from datetime import datetime
from datetime import timedelta
from datetime import timezone
import logging
from threading import Lock
from uuid import uuid4

from fastapi import HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import settings

logger = logging.getLogger("manuverse.audit")


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length is not None and int(content_length) > settings.max_request_size_bytes:
            return JSONResponse(status_code=413, content={"detail": "Request too large"})
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Content-Security-Policy"] = "default-src 'self'; connect-src 'self' http://127.0.0.1:8000 http://localhost:8000; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'"
        return response


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._hits: dict[str, list[datetime]] = defaultdict(list)
        self._lock = Lock()

    async def dispatch(self, request: Request, call_next):
        client_host = request.client.host if request.client else "unknown"
        key = f"{client_host}:{request.url.path}"
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(seconds=settings.rate_limit_window_seconds)

        with self._lock:
            bucket = [ts for ts in self._hits[key] if ts >= cutoff]
            if len(bucket) >= settings.rate_limit_max_requests:
                return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})
            bucket.append(now)
            self._hits[key] = bucket

        return await call_next(request)


class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = getattr(request.state, "request_id", "n/a")
        client_host = request.client.host if request.client else "unknown"
        auth_header = request.headers.get("authorization")
        masked_auth = "present" if auth_header else "none"

        response = await call_next(request)

        logger.info(
            "request path=%s method=%s status=%s request_id=%s client=%s auth=%s",
            request.url.path,
            request.method,
            response.status_code,
            request_id,
            client_host,
            masked_auth,
        )
        return response


def secure_http_exception(status_code: int, detail: str = "Operation failed") -> HTTPException:
    return HTTPException(status_code=status_code, detail=detail)
