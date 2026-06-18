"""Password hashing + JWT issue/verify + request auth helpers."""
import uuid
from datetime import datetime, timedelta, timezone
from functools import wraps

import bcrypt
import jwt
from flask import g, request

from app.config import Config
from app.db import get_session
from app.errors import ApiError
from app.models import User


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _issue(user_id: str, token_type: str, ttl_seconds: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": token_type,
        "iat": now,
        "exp": now + timedelta(seconds=ttl_seconds),
    }
    return jwt.encode(payload, Config.JWT_SECRET, algorithm=Config.JWT_ALGORITHM)


def issue_access_token(user_id: str) -> str:
    return _issue(user_id, "access", Config.JWT_ACCESS_TTL_SECONDS)


def issue_refresh_token(user_id: str) -> str:
    return _issue(user_id, "refresh", Config.JWT_REFRESH_TTL_SECONDS)


def decode_token(token: str, expected_type: str) -> dict:
    try:
        payload = jwt.decode(token, Config.JWT_SECRET, algorithms=[Config.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise ApiError("token_expired", "Session expired.", 401) from exc
    except jwt.InvalidTokenError as exc:
        raise ApiError("invalid_token", "Invalid token.", 401) from exc
    if payload.get("type") != expected_type:
        raise ApiError("invalid_token", "Wrong token type.", 401)
    return payload


def _load_user(user_id: str) -> User:
    session = get_session()
    try:
        user = session.get(User, uuid.UUID(user_id))
    except (ValueError, TypeError) as exc:
        raise ApiError("invalid_token", "Invalid subject.", 401) from exc
    if user is None:
        raise ApiError("invalid_token", "User not found.", 401)
    return user


def require_auth(fn):
    """Decorator: validates the Bearer access token and sets g.user / g.user_id."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            raise ApiError("unauthorized", "Missing bearer token.", 401)
        token = header[len("Bearer ") :].strip()
        payload = decode_token(token, "access")
        g.user = _load_user(payload["sub"])
        g.user_id = g.user.id
        return fn(*args, **kwargs)

    return wrapper
